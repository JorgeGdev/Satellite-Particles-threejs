import './main.css'
import * as THREE from 'three'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

const dracoLoader = new DRACOLoader()
const loader = new GLTFLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
dracoLoader.setDecoderConfig({ type: 'js' })
loader.setDRACOLoader(dracoLoader)

const container = document.createElement('div')
document.body.appendChild(container)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#000000')

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputEncoding = THREE.sRGBEncoding
container.appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 100)
camera.position.set(34,16,-20)
scene.add(camera)

window.addEventListener('resize', () => {
    const width = window.innerWidth
    const height = window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    renderer.setSize(width, height)
    renderer.setPixelRatio(2)
})

const controls = new OrbitControls(camera, renderer.domElement)

const ambient = new THREE.AmbientLight(0xa0a0fc, 0.82)
scene.add(ambient)

const sunLight = new THREE.DirectionalLight(0xe8c37b, 1.96)
sunLight.position.set(-69,44,14)
scene.add(sunLight)

loader.load('models/gltf/satelite.glb', function (gltf) {
    gltf.scene.traverse((obj) =>{
        if (obj.isMesh) {
            sampler = new MeshSurfaceSampler(obj).build()
        }
    })
    transformMesh()
})

let sampler;
const cursor = {x:0, y:0}
let uniforms = { mousePos: {value: new THREE.Vector3()}}
const vertices = [];
const tempPosition = new THREE.Vector3();
let pointsGeometry = new THREE.BufferGeometry();

function transformMesh(){
    for (let i = 0; i < 99000; i++) {
        sampler.sample(tempPosition);
        vertices.push(tempPosition.x, tempPosition.y, tempPosition.z);
    }

    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const pointsMaterial = new THREE.PointsMaterial({
        color: 0xFFCC4F,
        size: 0.1,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        sizeAttenuation: true,
        alphaMap: new THREE.TextureLoader().load('particle-texture.jpg')
    });

    pointsMaterial.onBeforeCompile = function(shader) {
        shader.uniforms.mousePos = uniforms.mousePos;

        shader.vertexShader = `
            uniform vec3 mousePos;
            varying float vNormal;
            
            ${shader.vertexShader}`.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>   
                vec3 seg = position - mousePos;
                vec3 dir = normalize(seg);
                float dist = length(seg);
                if (dist < 1.5){
                    float force = clamp(1.0 / (dist * dist), -0., .5);
                    transformed += dir * force;
                    vNormal = force / 0.5;
                }
            `
        );
    };

    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);
}

function introAnimation() {
    controls.enabled = false; 
    new TWEEN.Tween(camera.position.set(0, -1, 1)).to({
        x: 2,
        y: 5.4,
        z: 6.1
    }, 6500)
    .delay(1000).easing(TWEEN.Easing.Quartic.InOut).start()
    .onComplete(function () {
        controls.enabled = true;
        setOrbitControlsLimits();
        TWEEN.remove(this);
    });
}

introAnimation()

function setOrbitControlsLimits(){
    controls.enableDamping = true
    controls.dampingFactor = 0.04
    controls.minDistance = 0.5
    controls.maxDistance = 9
    controls.enableRotate = true
    controls.enableZoom = true
    controls.zoomSpeed = 0.5
    controls.autoRotate = true
}

function rendeLoop() {
    TWEEN.update()
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(rendeLoop)
}

rendeLoop()

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane();
const mouse = new THREE.Vector2();

document.addEventListener('mousemove', (event) => {
    event.preventDefault();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Actualiza el plano para que siempre sea perpendicular a la dirección de la cámara
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0, 0, 0)).normalize();

    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersect);

    uniforms.mousePos.value.set(intersect.x, intersect.y, intersect.z);
}, false);
