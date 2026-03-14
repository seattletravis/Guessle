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
