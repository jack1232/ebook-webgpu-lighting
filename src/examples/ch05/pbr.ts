import * as ws from 'webgpu-simplified';
import fsShader from './pbr-frag.wgsl';
import * as cci from '../ch02/ch02-common-instance';
import { vec3 } from 'gl-matrix';
import { getCubeData, getSphereData, getTorusData } from '../../common/vertex-data';

export const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    const NUM_CUBES = 100;
    const NUM_SPHERES = 100;
    const NUM_TORUS = 100;
    const numObjects = NUM_CUBES + NUM_SPHERES + NUM_TORUS;
    const cubeData = getCubeData();
    const sphereData = getSphereData(1.5, 40, 60);
    const torusData = getTorusData(1.5, 0.45, 60, 20);
    const data = {cubeData, sphereData, torusData};

    const p = await cci.createPipeline(init, data, fsShader, numObjects, 128, 32);

    let vt = ws.createViewTransform([0,0,1]);
    let viewMat = vt.viewMat;

    let aspect = init.size.width / init.size.height;      
    let projectMat = ws.createProjectionMat(aspect);
    let vpMat = ws.combineVpMat(viewMat, projectMat);
    init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);

    var camera = ws.getCamera(canvas, vt.cameraOptions);
    let eyePosition = new Float32Array(vt.cameraOptions.eye);
    let lightPosition = eyePosition;
           
    // write light parameters to buffer 
    init.device.queue.writeBuffer(p.uniformBuffers[4], 0, lightPosition);
    init.device.queue.writeBuffer(p.uniformBuffers[4], 16, eyePosition);

    var gui = ws.getDatGui();
    const params = {
        animateSpeed: 1,
        intensity: 300,
        roughness: 0.2,
        metallic: 0.8,
    };
       
    gui.add(params, 'animateSpeed', 0, 5, 0.1) ; 
    gui.add(params, 'intensity', 1, 500, 0.5);       
    gui.add(params, 'roughness', 0.05, 1, 0.01);  
    gui.add(params, 'metallic', 0, 1, 0.01); 
 
    const mn = cci.setModelNormalMatricesAndColors(init.device, p, numObjects, false);

    let start = performance.now();
    var stats = ws.getStats();
    const frame = () => {     
        stats.begin();

        projectMat = ws.createProjectionMat(aspect);
        if(camera.tick()){
            viewMat = camera.matrix;
            vpMat = ws.combineVpMat(viewMat, projectMat);
            eyePosition = new Float32Array(camera.eye.flat());
            init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
            init.device.queue.writeBuffer(p.uniformBuffers[4], 0, lightPosition);
            init.device.queue.writeBuffer(p.uniformBuffers[4], 16, eyePosition);
        }
    
        // update uniform buffers for transformation 
        init.device.queue.writeBuffer(p.uniformBuffers[1], 0, mn.mMat);  
        init.device.queue.writeBuffer(p.uniformBuffers[2], 0, mn.nMat);  
  
        var dt = (performance.now() - start)/1000;     
        let sn = (2 + Math.sin(dt * params.animateSpeed))/3;
        let cn = (2 + Math.cos(dt * params.animateSpeed))/3; 
        let dz = 5;
        let factor = 15;
        let lightPos0 = vec3.fromValues(-factor*sn, factor*cn, factor*cn - dz);
        let lightPos1 = vec3.fromValues(factor*sn, factor*cn, factor*cn - dz);
        let lightPos2 = vec3.fromValues(-factor*sn, -factor*cn, factor*cn - dz);
        let lightPos3 = vec3.fromValues(factor*sn, -factor*cn, factor*cn - dz);

        init.device.queue.writeBuffer(p.uniformBuffers[4], 0, new Float32Array([
            lightPos0[0], lightPos0[1], lightPos0[2], 1,            
            params.intensity, params.intensity, params.intensity, 1,
            lightPos1[0], lightPos1[1], lightPos1[2], 1,
            params.intensity, params.intensity, params.intensity, 1,
            lightPos2[0], lightPos2[1], lightPos2[2], 1,
            params.intensity, params.intensity, params.intensity, 1,
            lightPos3[0], lightPos3[1], lightPos3[2], 1,
            params.intensity, params.intensity, params.intensity, 1,
        ]));

        // update uniform buffer for material
        init.device.queue.writeBuffer(p.uniformBuffers[5], 0, new Float32Array([
            eyePosition[0], eyePosition[1], eyePosition[2], 1.0,
            params.roughness, params.metallic, 0, 0,
        ]));

        const numShapes = {
            cube: NUM_CUBES,
            sphere: NUM_SPHERES,
            torus: NUM_TORUS,
        }
        cci.draw(init, p, data, numShapes);   
        
        requestAnimationFrame(frame);
        stats.end();
    };
    frame();
}

run();