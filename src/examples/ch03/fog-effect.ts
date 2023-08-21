import frag_shader from './fog-frag.wgsl';
import * as ws from 'webgpu-simplified';
import { getCubeData, getSphereData, getTorusData } from '../../common/vertex-data';
import * as cci from '../ch02/ch02-common-instance';

export const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    const NUM_CUBES = 100;
    const NUM_SPHERES = 100;
    const NUM_TORUS = 100;
    const numObjects = NUM_CUBES + NUM_SPHERES + NUM_TORUS;
    const cubeData = getCubeData();
    const sphereData = getSphereData(1.5, 20, 32);
    const torusData = getTorusData(1.5, 0.45, 30, 10);
    const data = {cubeData, sphereData, torusData};

    const p = await cci.createPipeline(init, data, frag_shader, numObjects, 64, 24);

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
    document.querySelector('#gui').append(gui.domElement);
    const params = {
        animateSpeed: 1,
        specularColor: '#ffffff',
        fogColor: '#aaaaaa',
        ambient: 0.1,
        diffuse: 0.7,
        specular: 0.4,
        shininess: 30,
        minDist: 5,
        maxDist: 70,
    };
    
    gui.add(params, 'animateSpeed', 0, 5, 0.01);      
    var folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.addColor(params, 'specularColor');   
    folder.add(params, 'ambient', 0, 1, 0.02);  
    folder.add(params, 'diffuse', 0, 1, 0.02);  
    folder.add(params, 'specular', 0, 1, 0.02);  
    folder.add(params, 'shininess', 0, 300, 1);  

    folder = gui.addFolder('Set fog parameters');
    folder.open();
    folder.addColor(params, 'fogColor');
    folder.add(params, 'minDist', 0, 50, 0.1);  
    folder.add(params, 'maxDist', 51, 400, 0.5);  

    const mn =  cci.setModelNormalMatricesAndColors(init.device, p, numObjects, false);

    let stats = ws.getStats();
    let start = performance.now();
    const frame = () => {     
        stats.begin();

        projectMat = ws.createProjectionMat(aspect);
        if(camera.tick()){
            viewMat = camera.matrix;
            vpMat = ws.combineVpMat(viewMat, projectMat);
            eyePosition = new Float32Array(camera.eye.flat());
            lightPosition = eyePosition;
            init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
            init.device.queue.writeBuffer(p.uniformBuffers[4], 0, lightPosition);
            init.device.queue.writeBuffer(p.uniformBuffers[4], 16, eyePosition);
        }
       
        // update uniform buffers for transformation 
        init.device.queue.writeBuffer(p.uniformBuffers[1], 0, mn.mMat);  
        init.device.queue.writeBuffer(p.uniformBuffers[2], 0, mn.nMat);  

        // update uniform buffers for light direction and colors
        let dt = (performance.now() - start)/1000;
        let sn = 10 * (0.2 + Math.sin(params.animateSpeed*dt));
        let cn = 10 * (0.2 + Math.cos(params.animateSpeed*dt));      
        init.device.queue.writeBuffer(p.uniformBuffers[4], 0, Float32Array.of(2*sn, 2*cn, 4));
        init.device.queue.writeBuffer(p.uniformBuffers[4], 32, ws.hex2rgb(params.specularColor));
        init.device.queue.writeBuffer(p.uniformBuffers[4], 48, ws.hex2rgb(params.fogColor));

        // update material uniform buffer
        init.device.queue.writeBuffer(p.uniformBuffers[5], 0, Float32Array.of(
            params.ambient, params.diffuse, params.specular, params.shininess, params.minDist, params.maxDist
        ));

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