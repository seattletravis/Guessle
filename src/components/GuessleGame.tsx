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
			antialias: false,
			stencil: false,
			depth: true,
			powerPreference: 'high-performance',
		});

		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.shadowMap.enabled = false;
		renderer.toneMapping = THREE.NoToneMapping;
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

		// --- WORLD ---
		const world = new CANNON.World({
			gravity: new CANNON.Vec3(0, -9.82, 0),
		});

		world.defaultContactMaterial.contactEquationStiffness = 1e8;
		world.defaultContactMaterial.contactEquationRelaxation = 3;
		world.broadphase = new CANNON.SAPBroadphase(world);
		world.allowSleep = true;

		const solver = new CANNON.GSSolver();
		solver.iterations = 20;
		solver.tolerance = 0.001;
		world.solver = new CANNON.SplitSolver(solver);

		const candyMaterial = new CANNON.Material('candy');
		const tableMaterial = new CANNON.Material('table');

		world.addContactMaterial(
			new CANNON.ContactMaterial(candyMaterial, tableMaterial, {
				friction: 0.4,
				restitution: 0.2,
			}),
		);

		// --- JAR PHYSICS (box approximation) ---
		const jarBody = new CANNON.Body({
			type: CANNON.Body.STATIC,
		});

		const radius = 5;
		const height = 10;
		const wallThickness = 0.2;

		// Left wall
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(wallThickness, height / 2, radius)),
			new CANNON.Vec3(-radius, 0, 0),
		);

		// Right wall
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(wallThickness, height / 2, radius)),
			new CANNON.Vec3(radius, 0, 0),
		);

		// Front wall
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(radius, height / 2, wallThickness)),
			new CANNON.Vec3(0, 0, radius),
		);

		// Back wall
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(radius, height / 2, wallThickness)),
			new CANNON.Vec3(0, 0, -radius),
		);

		// Bottom
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(radius, 0.2, radius)),
			new CANNON.Vec3(0, -height / 2, 0),
		);

		world.addBody(jarBody);

		// --- TABLE PHYSICS ---
		const tableBody = new CANNON.Body({
			type: CANNON.Body.STATIC,
			shape: new CANNON.Box(new CANNON.Vec3(15, 0.5, 15)),
			position: new CANNON.Vec3(0, -5, 0), // aligned with visual table
		});
		tableBody.material = tableMaterial;
		world.addBody(tableBody);

		// --- LIGHTS ---
		scene.add(new THREE.AmbientLight(0xffffff, 0.6));

		const directional = new THREE.DirectionalLight(0xffffff, 0.8);
		directional.position.set(10, 20, 10);
		scene.add(directional);

		// --- JAR VISUALS (square to match physics) ---
		const jarGroup = new THREE.Group();
		scene.add(jarGroup);

		const wallMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.25,
			roughness: 0.1,
			metalness: 0.0,
		});

		// Left visual wall
		const leftWall = new THREE.Mesh(
			new THREE.BoxGeometry(wallThickness * 2, height, radius * 2),
			wallMat,
		);
		leftWall.position.set(-radius, 0, 0);
		jarGroup.add(leftWall);

		// Right visual wall
		const rightWall = new THREE.Mesh(
			new THREE.BoxGeometry(wallThickness * 2, height, radius * 2),
			wallMat,
		);
		rightWall.position.set(radius, 0, 0);
		jarGroup.add(rightWall);

		// Front visual wall
		const frontWall = new THREE.Mesh(
			new THREE.BoxGeometry(radius * 2, height, wallThickness * 2),
			wallMat,
		);
		frontWall.position.set(0, 0, radius);
		jarGroup.add(frontWall);

		// Back visual wall
		const backWall = new THREE.Mesh(
			new THREE.BoxGeometry(radius * 2, height, wallThickness * 2),
			wallMat,
		);
		backWall.position.set(0, 0, -radius);
		jarGroup.add(backWall);

		// Bottom
		const bottomMesh = new THREE.Mesh(
			new THREE.BoxGeometry(radius * 2, wallThickness * 2, radius * 2),
			new THREE.MeshStandardMaterial({ color: 0xdddddd }),
		);
		bottomMesh.position.set(0, -height / 2, 0);
		jarGroup.add(bottomMesh);

		// --- BACKGROUND + TABLE VISUAL ---
		scene.background = new THREE.Color(0x222222);

		const table = new THREE.Mesh(
			new THREE.BoxGeometry(30, 1, 30),
			new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
		);
		table.position.set(0, -5, 0);
		scene.add(table);

		// --- CANDY FACTORY ---
		function createCandy() {
			const geo = new THREE.SphereGeometry(0.3, 16, 16);
			const mat = new THREE.MeshStandardMaterial({
				color: new THREE.Color(`hsl(${Math.random() * 360}, 80%, 60%)`),
			});
			const mesh = new THREE.Mesh(geo, mat);
			scene.add(mesh);

			const shape = new CANNON.Sphere(0.3);
			const body = new CANNON.Body({
				mass: 0.1,
				shape,
				position: new CANNON.Vec3(
					(Math.random() - 0.5) * 2,
					5 + Math.random() * 2,
					(Math.random() - 0.5) * 2,
				),
			});
			body.material = candyMaterial;
			world.addBody(body);

			return { mesh, body };
		}

		const candies: { mesh: THREE.Mesh; body: CANNON.Body }[] = [];
		for (let i = 0; i < 20; i++) {
			candies.push(createCandy());
		}

		// --- ANIMATION LOOP ---
		function animate() {
			requestAnimationFrame(animate);
			world.step(1 / 120);
			renderer.render(scene, camera);

			for (const c of candies) {
				c.mesh.position.copy(c.body.position as any);
				c.mesh.quaternion.copy(c.body.quaternion as any);
			}
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
