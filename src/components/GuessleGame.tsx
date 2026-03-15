import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type DigitKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type DigitColor = 'white' | 'green' | 'yellow' | 'red';
type DigitState = Record<DigitKey, DigitColor>;

export default function GuessleGame() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	// -----------------------------
	// GUESSLE LOGIC
	// -----------------------------

	function generateAnswer() {
		const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
		const answer = [];

		while (answer.length < 4) {
			const d = digits.splice(Math.floor(Math.random() * digits.length), 1)[0];
			if (answer.length === 0 && d === '0') continue;
			answer.push(d);
		}
		return answer.join('');
	}

	const answer = useRef(generateAnswer());

	const [digitState, setDigitState] = useState<DigitState>({
		'0': 'white',
		'1': 'white',
		'2': 'white',
		'3': 'white',
		'4': 'white',
		'5': 'white',
		'6': 'white',
		'7': 'white',
		'8': 'white',
		'9': 'white',
	});

	const [guesses, setGuesses] = useState([
		['', '', '', ''],
		['', '', '', ''],
		['', '', '', ''],
		['', '', '', ''],
	]);

	const [guessColors, setGuessColors] = useState([
		['', '', '', ''],
		['', '', '', ''],
		['', '', '', ''],
		['', '', '', ''],
	]);

	const [activeRow, setActiveRow] = useState(0);

	const [usedThisRow, setUsedThisRow] = useState<Set<DigitKey>>(new Set());
	const [gameOver, setGameOver] = useState<null | 'win' | 'lose'>(null);
	function enterDigit(d: DigitKey) {
		// block if already used in this row
		if (usedThisRow.has(d)) return;

		setGuesses((prev) => {
			const newGrid = [...prev];
			const row = [...newGrid[activeRow]];
			const idx = row.findIndex((x) => x === '');
			if (idx !== -1) {
				row[idx] = d;
				newGrid[activeRow] = row;
			}
			return newGrid;
		});

		// mark digit as used this row
		setUsedThisRow((prev) => new Set(prev).add(d));
	}

	function evaluateGuess(guess: string) {
		const ans = answer.current.split('');
		const g = guess.split('');
		const result = ['red', 'red', 'red', 'red'];

		for (let i = 0; i < 4; i++) {
			if (g[i] === ans[i]) result[i] = 'green';
		}

		for (let i = 0; i < 4; i++) {
			if (result[i] === 'green') continue;
			if (ans.includes(g[i])) result[i] = 'yellow';
		}

		return result;
	}

	function updateDigitBoard(guess: string, result: string[]) {
		setDigitState((prev) => {
			const next = { ...prev };

			guess.split('').forEach((d, i) => {
				const key = d as DigitKey;
				const color = result[i];

				if (color === 'green') {
					next[key] = 'green';
				} else if (color === 'yellow') {
					// yellow should NOT override green
					if (next[key] !== 'green') next[key] = 'yellow';
				} else if (color === 'red') {
					// red only applies if digit was never yellow or green
					if (next[key] === 'white') next[key] = 'red';
				}
			});

			return next;
		});
	}
	function submitGuess() {
		const guess = guesses[activeRow].join('');
		if (guess.length < 4) return;

		const result = evaluateGuess(guess);

		// update keyboard colors
		updateDigitBoard(guess, result);

		// update grid tile colors
		setGuessColors((prev) => {
			const next = [...prev];
			next[activeRow] = result;
			return next;
		});

		// win condition
		if (result.every((r) => r === 'green')) {
			setGameOver('win');
			return;
		}

		// move to next row
		if (activeRow < 3) {
			const nextRow = activeRow + 1;
			setActiveRow(nextRow);

			// reset yellow digits to white
			setDigitState((prev) => {
				const next = { ...prev };
				for (const key in next) {
					if (next[key as DigitKey] === 'yellow') {
						next[key as DigitKey] = 'white';
					}
				}
				return next;
			});

			// reset row usage
			setUsedThisRow(new Set());
		}
		// lose condition (no more rows)
		if (activeRow === 3) {
			setGameOver('lose');
		}
	}
	useEffect(() => {
		if (activeRow === 0) return; // nothing to auto-fill on first row

		setGuesses((prev) => {
			const newGrid = [...prev];
			const newRow = [...newGrid[activeRow]];

			// fill in green digits from previous row
			for (let i = 0; i < 4; i++) {
				if (guessColors[activeRow - 1][i] === 'green') {
					newRow[i] = guesses[activeRow - 1][i];

					// mark digit as used this row
					setUsedThisRow((prev) => new Set(prev).add(newRow[i] as DigitKey));
				}
			}

			newGrid[activeRow] = newRow;
			return newGrid;
		});
	}, [activeRow]);
	// -----------------------------
	// THREE + CANNON
	// -----------------------------

	useEffect(() => {
		const scene = new THREE.Scene();

		// PANOSPHERE
		const panoGeo = new THREE.SphereGeometry(50, 60, 40);
		panoGeo.scale(-1, 1, 1);
		const panoTex = new THREE.TextureLoader().load('/bg.jpg');
		panoTex.colorSpace = THREE.SRGBColorSpace;
		const panoMat = new THREE.MeshBasicMaterial({ map: panoTex });
		scene.add(new THREE.Mesh(panoGeo, panoMat));

		// CAMERA
		const camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			0.1,
			1000,
		);

		const aspect = window.innerWidth / window.innerHeight;
		let cameraZ = 20;
		if (aspect < 0.6) cameraZ = 28;
		if (aspect < 0.5) cameraZ = 32;
		if (aspect > 1.6) cameraZ = 24;
		if (aspect > 2.0) cameraZ = 28;

		camera.position.set(5, 4, cameraZ);

		// RENDERER
		const renderer = new THREE.WebGLRenderer({
			canvas: canvasRef.current!,
			antialias: false,
			depth: true,
			powerPreference: 'high-performance',
		});

		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		// CONTROLS
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.minDistance = 10;
		controls.maxDistance = 40;
		controls.minPolarAngle = 0.3;
		controls.maxPolarAngle = Math.PI / 2.1;
		controls.target.set(0, 4, 0);
		// ⭐ Move the camera AFTER controls exist
		controls.update();

		// LIGHTS
		scene.add(new THREE.AmbientLight(0xffffff, 1.2));
		const key = new THREE.DirectionalLight(0xffffff, 1.0);
		key.position.set(-10, 15, -5);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0xffffff, 0.6);
		rim.position.set(0, 10, 20);
		scene.add(rim);

		// PHYSICS WORLD (jar only)
		const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
		world.allowSleep = true;

		const solver = new CANNON.GSSolver();
		solver.iterations = 40;
		solver.tolerance = 0.001;
		world.solver = new CANNON.SplitSolver(solver);

		const tableMat = new CANNON.Material('table');

		// TABLE
		const woodTex = new THREE.TextureLoader().load('/wood.jpg');
		woodTex.colorSpace = THREE.SRGBColorSpace;
		woodTex.wrapS = THREE.RepeatWrapping;
		woodTex.wrapT = THREE.RepeatWrapping;
		woodTex.repeat.set(2, 2);

		const table = new THREE.Mesh(
			new THREE.BoxGeometry(30, 1, 30),
			new THREE.MeshStandardMaterial({
				map: woodTex,
				roughness: 0.8,
				metalness: 0.0,
			}),
		);
		table.position.set(0, -5, 0);
		scene.add(table);

		const tableBody = new CANNON.Body({
			type: CANNON.Body.STATIC,
			shape: new CANNON.Box(new CANNON.Vec3(15, 0.5, 15)),
			position: new CANNON.Vec3(0, -5, 0),
		});
		tableBody.material = tableMat;
		world.addBody(tableBody);

		// JAR
		const radius = 5;
		const height = 10;
		const wallThickness = 0.25;

		const jarBody = new CANNON.Body({ type: CANNON.Body.STATIC });

		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(wallThickness, height / 2, radius)),
			new CANNON.Vec3(-radius + 0.05, 0, 0),
		);
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(wallThickness, height / 2, radius)),
			new CANNON.Vec3(radius - 0.05, 0, 0),
		);
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(radius, height / 2, wallThickness)),
			new CANNON.Vec3(0, 0, radius - 0.05),
		);
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(radius, height / 2, wallThickness)),
			new CANNON.Vec3(0, 0, -radius + 0.05),
		);
		jarBody.addShape(
			new CANNON.Box(new CANNON.Vec3(radius, 0.2, radius)),
			new CANNON.Vec3(0, -height / 2, 0),
		);

		world.addBody(jarBody);

		const jarGroup = new THREE.Group();
		scene.add(jarGroup);

		const wallMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.3,
			roughness: 0.05,
		});

		function addWall(w: THREE.Mesh, x: number, y: number, z: number) {
			w.position.set(x, y, z);
			jarGroup.add(w);
		}

		addWall(
			new THREE.Mesh(
				new THREE.BoxGeometry(wallThickness * 2, height, radius * 2),
				wallMat,
			),
			-radius + 0.05,
			0,
			0,
		);
		addWall(
			new THREE.Mesh(
				new THREE.BoxGeometry(wallThickness * 2, height, radius * 2),
				wallMat,
			),
			radius - 0.05,
			0,
			0,
		);
		addWall(
			new THREE.Mesh(
				new THREE.BoxGeometry(radius * 2, height, wallThickness * 2),
				wallMat,
			),
			0,
			0,
			radius - 0.05,
		);
		addWall(
			new THREE.Mesh(
				new THREE.BoxGeometry(radius * 2, height, wallThickness * 2),
				wallMat,
			),
			0,
			0,
			-radius + 0.05,
		);

		const bottomMesh = new THREE.Mesh(
			new THREE.BoxGeometry(radius * 2, wallThickness * 2, radius * 2),
			new THREE.MeshStandardMaterial({ color: 0xdddddd }),
		);
		bottomMesh.position.set(0, -height / 2, 0);
		jarGroup.add(bottomMesh);

		// -----------------------------
		// REALISTIC STACKED CANDY (HEX PACKING)
		// -----------------------------

		const actual = parseInt(answer.current, 10);
		const count = actual;

		const candyRadius = 0.25;
		const candyDiameter = candyRadius * 2;

		const candyGeo = new THREE.SphereGeometry(candyRadius, 12, 12);
		const candyMat = new THREE.MeshPhysicalMaterial({
			roughness: 0.05,
			metalness: 0.0,
			clearcoat: 1.0,
			clearcoatRoughness: 0.05,
		});

		const instanced = new THREE.InstancedMesh(candyGeo, candyMat, count);
		scene.add(instanced);

		const dummy = new THREE.Object3D();

		let placed = 0;
		let y = -height / 2 + candyRadius; // start at bottom

		while (placed < count) {
			// how many candies fit across the jar?
			const rowWidth = radius * 1.8;
			const candiesPerRow = Math.floor(rowWidth / candyDiameter);

			for (let row = 0; row < candiesPerRow && placed < count; row++) {
				// hex offset every other row
				const offset = row % 2 === 0 ? 0 : candyRadius;

				for (let col = 0; col < candiesPerRow && placed < count; col++) {
					const x = -rowWidth / 2 + col * candyDiameter + offset;
					const z = -rowWidth / 2 + row * candyDiameter;

					// skip if outside jar radius
					if (x * x + z * z > radius * radius * 0.9) continue;

					// slight jitter for natural look
					const jitterX = (Math.random() - 0.5) * 0.1;
					const jitterZ = (Math.random() - 0.5) * 0.1;

					dummy.position.set(x + jitterX, y, z + jitterZ);

					dummy.rotation.set(
						Math.random() * Math.PI,
						Math.random() * Math.PI,
						Math.random() * Math.PI,
					);

					dummy.updateMatrix();
					instanced.setMatrixAt(placed, dummy.matrix);

					instanced.setColorAt(
						placed,
						new THREE.Color(`hsl(${Math.random() * 360}, 80%, 60%)`),
					);

					placed++;
				}
			}

			// move up to next layer
			y += candyDiameter * 0.9; // slight compression for realism
		}

		instanced.instanceMatrix.needsUpdate = true;
		// ANIMATION LOOP
		function animate() {
			requestAnimationFrame(animate);
			world.step(1 / 60);
			controls.update();
			renderer.render(scene, camera);
		}
		animate();

		return () => renderer.dispose();
	}, []);

	// -----------------------------
	// UI RENDER
	// -----------------------------

	const sortedDigits = (Object.keys(digitState) as DigitKey[]).sort((a, b) => {
		const order = { green: 2, yellow: 0, red: 1, white: 0 };
		return order[digitState[a]] - order[digitState[b]];
	});

	return (
		<div
			style={{
				width: '100vw',
				height: '100vh',
				position: 'fixed',
				inset: 0,
				overflow: 'hidden',
				touchAction: 'none',
			}}>
			<canvas
				ref={canvasRef}
				style={{
					position: 'absolute',
					inset: 0,
					zIndex: 0,
				}}
			/>

			{/* DIGIT BOARD */}
			<div className='digit-board'>
				{sortedDigits.map((d) => {
					const permanent = digitState[d]; // green, yellow, red, white
					const tempGrey = usedThisRow.has(d) ? 'grey' : '';

					const disabled =
						permanent === 'green' || permanent === 'red' || tempGrey === 'grey'
							? 'disabled'
							: '';

					return (
						<div
							key={d}
							className={`digit ${permanent} ${tempGrey} ${disabled}`}
							onClick={() => {
								if (disabled) return;
								enterDigit(d);
							}}>
							{d}
						</div>
					);
				})}
			</div>

			{/* GUESS GRID */}
			<div className='guess-grid'>
				{guesses.map((row, r) => (
					<div key={r} className='guess-row'>
						{row.map((digit, c) => (
							<div key={c} className={`guess-box ${guessColors[r][c]}`}>
								{digit}
							</div>
						))}
					</div>
				))}
			</div>

			{/* GUESS BUTTON */}
			<button className='guess-button' onClick={submitGuess}>
				Guess
			</button>
			{gameOver === 'win' && (
				<div className='end-screen'>
					<div className='end-box'>
						<h1>You Win!</h1>
						<button onClick={() => window.location.reload()}>Play Again</button>
					</div>
				</div>
			)}

			{gameOver === 'lose' && (
				<div className='end-screen'>
					<div className='end-box'>
						<h1>Please Try Again</h1>
						<p>The number was: {answer.current}</p>
						<button onClick={() => window.location.reload()}>Play Again</button>
					</div>
				</div>
			)}
		</div>
	);
}
