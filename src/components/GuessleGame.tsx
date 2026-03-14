import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export default function GuessleGame() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const scene = new THREE.Scene();

		const camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			0.1,
			1000,
		);
		camera.position.set(5, 2, 20);

		const renderer = new THREE.WebGLRenderer({
			canvas: canvasRef.current!,
			antialias: true,
		});
		renderer.setSize(window.innerWidth, window.innerHeight);

		const world = new CANNON.World({
			gravity: new CANNON.Vec3(0, -9.82, 0),
		});
		// Add a basic light so we can see geometry
		const ambient = new THREE.AmbientLight(0xffffff, 0.6);
		scene.add(ambient);

		const directional = new THREE.DirectionalLight(0xffffff, 0.8);
		directional.position.set(10, 20, 10);
		scene.add(directional);
		// Add temp test objects for light confirmation
		const testGeo = new THREE.BoxGeometry(2, 2, 2);
		const testMat = new THREE.MeshStandardMaterial({ color: 'hotpink' });
		const testMesh = new THREE.Mesh(testGeo, testMat);
		scene.add(testMesh);
		// Add background
		scene.background = new THREE.Color(0x222222);
		// Add Table
		const tableGeo = new THREE.BoxGeometry(30, 1, 30);
		const tableMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
		const table = new THREE.Mesh(tableGeo, tableMat);
		table.position.set(0, -5, 0);
		scene.add(table);
		// Add jar
		const jarGeo = new THREE.CylinderGeometry(5, 5, 10, 32);
		const jarMat = new THREE.MeshStandardMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.2,
		});
		const jar = new THREE.Mesh(jarGeo, jarMat);
		jar.position.set(0, 0, 0);
		scene.add(jar);
		function animate() {
			requestAnimationFrame(animate);
			world.step(1 / 60);
			renderer.render(scene, camera);
		}
		animate();

		return () => {
			renderer.dispose();
		};
	}, []);

	return (
		<div style={{ width: '100vw', height: '100vh' }}>
			<canvas ref={canvasRef} />
		</div>
	);
}
