import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameStats } from '../types';

interface Game3DProps {
  onUpdateStats: (stats: GameStats) => void;
  onGameOver: (score: number) => void;
  actionRef: React.MutableRefObject<{
    moveLeft: () => void;
    moveRight: () => void;
    jump: () => void;
    startGame: () => void;
    resetGame: () => void;
  } | null>;
}

export default function Game3D({ onUpdateStats, onGameOver, actionRef }: Game3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Game State Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const runnerRef = useRef<THREE.Group | null>(null);
  const runnerPartsRef = useRef<{
    bodyGroup: THREE.Group;
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    head: THREE.Mesh;
  } | null>(null);
  const trackRef = useRef<THREE.Mesh | null>(null);
  
  // Audio Refs for SFX
  const jumpSound = useRef<HTMLAudioElement | null>(null);
  const coinSound = useRef<HTMLAudioElement | null>(null);
  const crashSound = useRef<HTMLAudioElement | null>(null);

  // Game Logic Refs
  const obstaclesRef = useRef<THREE.Mesh[]>([]);
  const coinsRef = useRef<THREE.Mesh[]>([]);
  const sceneryRef = useRef<THREE.Group[]>([]);
  const requestRef = useRef<number>(0);
  
  const stateRef = useRef({
    score: 0,
    speed: 0.5,
    distance: 0,
    lane: 0, // -1, 0, 1
    isRunning: false,
    isGameOver: false,
    isJumping: false,
    jumpVelocity: 0,
    cameraOffset: 0
  });

  // Initialize SFX
  useEffect(() => {
    jumpSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2024/2024-preview.mp3'); // Swoosh
    coinSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); // Arcade Gain
    crashSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3'); // Hit/Crash

    // Preload
    jumpSound.current.volume = 0.4;
    coinSound.current.volume = 0.4;
    crashSound.current.volume = 0.5;
  }, []);

  const playSound = (sound: HTMLAudioElement | null) => {
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(e => console.warn('SFX play failed', e));
    }
  };

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    // Adjusted fog to see further down the track
    scene.fog = new THREE.Fog(0x87CEEB, 60, 300);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 14); // Slightly higher and further back
    camera.lookAt(0, 0, -20); // Look further down the track
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance' 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- WORLD BUILDING ---

    // Sky
    const skyGeometry = new THREE.PlaneGeometry(1000, 1000);
    const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.position.z = -500;
    scene.add(sky);

    // Clouds
    for (let i = 0; i < 20; i++) {
      const cloudGeo = new THREE.DodecahedronGeometry(Math.random() * 5 + 3);
      const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        Math.random() * 400 - 200, 
        Math.random() * 50 + 30, 
        Math.random() * 200 - 100
      );
      scene.add(cloud);
    }

    // --- ANIMATED RUNNER ---
    const runnerGroup = new THREE.Group();
    const bodyGroup = new THREE.Group(); // Sub-group for visual parts
    runnerGroup.add(bodyGroup);

    // Materials
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdbac });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0xea580c }); // Orange
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2563eb }); // Blue

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.8, 1.2, 0.45);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.4; 
    torso.castShadow = true;
    bodyGroup.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 2.4;
    head.castShadow = true;
    bodyGroup.add(head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.25, 1.0, 0.25);
    armGeo.translate(0, -0.4, 0); // Pivot at shoulder

    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.6, 1.9, 0);
    leftArm.castShadow = true;
    bodyGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.6, 1.9, 0);
    rightArm.castShadow = true;
    bodyGroup.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.28, 1.1, 0.28);
    legGeo.translate(0, -0.5, 0); // Pivot at hip

    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.25, 0.8, 0);
    leftLeg.castShadow = true;
    bodyGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.25, 0.8, 0);
    rightLeg.castShadow = true;
    bodyGroup.add(rightLeg);

    runnerGroup.position.set(0, 0, 0);
    scene.add(runnerGroup);
    runnerRef.current = runnerGroup;
    runnerPartsRef.current = { bodyGroup, leftArm, rightArm, leftLeg, rightLeg, head };

    // Track
    const trackGeometry = new THREE.PlaneGeometry(30, 1000);
    const trackMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.z = -500;
    track.receiveShadow = true;
    scene.add(track);
    trackRef.current = track;

    // Grass
    const grassGeometry = new THREE.PlaneGeometry(200, 1000);
    const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    
    const leftGrass = new THREE.Mesh(grassGeometry, grassMaterial);
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.set(-115, -0.1, -500);
    leftGrass.receiveShadow = true;
    scene.add(leftGrass);

    const rightGrass = new THREE.Mesh(grassGeometry, grassMaterial);
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.set(115, -0.1, -500);
    rightGrass.receiveShadow = true;
    scene.add(rightGrass);

    // Lane Markings
    for (let i = -1; i <= 1; i++) {
        const laneGeo = new THREE.PlaneGeometry(0.2, 1000);
        const laneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
        const laneMark = new THREE.Mesh(laneGeo, laneMat);
        laneMark.rotation.x = -Math.PI / 2;
        laneMark.position.set(i * 5, 0.02, -500);
        scene.add(laneMark);
    }

    // Initial Scenery
    initScenery(scene);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 80, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    scene.add(dirLight);

    // Start Animation Loop immediately for idle animation
    requestRef.current = requestAnimationFrame(animate);

    // Event Listener for resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Initialize/Reset Scenery
  const initScenery = (scene: THREE.Scene) => {
    sceneryRef.current.forEach(s => scene.remove(s));
    sceneryRef.current = [];
    for (let i = 0; i < 40; i++) {
      createSceneryItem(scene, Math.random() * 1000);
    }
  };

  const createSceneryItem = (scene: THREE.Scene, zPos: number) => {
    const isTree = Math.random() > 0.4;
    const group = new THREE.Group();
    const xPos = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 60);

    if (isTree) {
       // Tree
       const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 3, 6);
       const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
       const trunk = new THREE.Mesh(trunkGeo, trunkMat);
       trunk.position.y = 1.5;
       trunk.castShadow = true;
       group.add(trunk);

       const leavesGeo = new THREE.ConeGeometry(3, 7, 8);
       const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
       const leaves = new THREE.Mesh(leavesGeo, leavesMat);
       leaves.position.y = 4.5;
       leaves.castShadow = true;
       group.add(leaves);
    } else {
       // Rock
       const geo = new THREE.DodecahedronGeometry(Math.random() * 1.5 + 1);
       const mat = new THREE.MeshLambertMaterial({ color: 0x777777 });
       const rock = new THREE.Mesh(geo, mat);
       rock.position.y = 1;
       rock.castShadow = true;
       group.add(rock);
    }

    group.position.set(xPos, 0, -zPos);
    scene.add(group);
    sceneryRef.current.push(group);
  };


  // --- GAME LOGIC ---

  const startGame = () => {
    stateRef.current.isRunning = true;
    stateRef.current.isGameOver = false;
  };

  const resetGame = () => {
    stateRef.current = {
        score: 0,
        speed: 0.5,
        distance: 0,
        lane: 0,
        isRunning: true,
        isGameOver: false,
        isJumping: false,
        jumpVelocity: 0,
        cameraOffset: 0
    };

    if (runnerRef.current) {
        runnerRef.current.position.set(0, 0, 0);
        runnerRef.current.rotation.set(0,0,0);
    }
    
    // Reset limbs
    if (runnerPartsRef.current) {
        const parts = runnerPartsRef.current;
        parts.bodyGroup.position.y = 0;
        parts.bodyGroup.rotation.x = 0;
        parts.leftArm.rotation.set(0,0,0);
        parts.rightArm.rotation.set(0,0,0);
        parts.leftLeg.rotation.set(0,0,0);
        parts.rightLeg.rotation.set(0,0,0);
    }

    const scene = sceneRef.current;
    if (scene) {
        obstaclesRef.current.forEach(o => scene.remove(o));
        coinsRef.current.forEach(c => scene.remove(c));
        obstaclesRef.current = [];
        coinsRef.current = [];
    }
  };

  const moveLeft = () => {
    if (stateRef.current.lane > -1 && !stateRef.current.isGameOver) {
        stateRef.current.lane--;
    }
  };

  const moveRight = () => {
    if (stateRef.current.lane < 1 && !stateRef.current.isGameOver) {
        stateRef.current.lane++;
    }
  };

  const jump = () => {
      if (!stateRef.current.isJumping && !stateRef.current.isGameOver) {
          stateRef.current.isJumping = true;
          stateRef.current.jumpVelocity = 0.4;
          playSound(jumpSound.current);
      }
  };

  // The Main Loop
  const animate = () => {
    requestRef.current = requestAnimationFrame(animate);

    const delta = 0.016; // Approx 60fps
    const time = Date.now() * 0.001;

    // 1. ANIMATION (Idle or Running)
    if (runnerPartsRef.current) {
        const parts = runnerPartsRef.current;
        
        if (stateRef.current.isRunning && !stateRef.current.isGameOver) {
            // Running Animation (Sine wave)
            const speedMult = 20 * stateRef.current.speed;
            const armAngle = Math.cos(time * speedMult);
            const legAngle = Math.sin(time * speedMult);

            // Lean forward slightly
            parts.bodyGroup.rotation.x = 0.15;
            
            // Bounce body with step
            // Double frequency of legs because two steps per cycle
            parts.bodyGroup.position.y = Math.abs(Math.cos(time * speedMult)) * 0.15;

            parts.leftArm.rotation.x = armAngle * 1.2;
            parts.rightArm.rotation.x = -armAngle * 1.2;
            parts.leftLeg.rotation.x = -legAngle * 1.2;
            parts.rightLeg.rotation.x = legAngle * 1.2;
            
            // Head bob inverse to body bounce to stabilize view slightly? Or just follow.
            // Let's make head follow body + slight offset
            // parts.head.position.y is relative to bodyGroup.
        } else {
            // Idle Animation (Breathing)
            const breath = Math.sin(time * 2) * 0.05;
            parts.bodyGroup.rotation.x = 0;
            parts.bodyGroup.position.y = 0;
            parts.leftArm.rotation.x = breath;
            parts.rightArm.rotation.x = breath;
            parts.leftArm.rotation.z = 0.1;
            parts.rightArm.rotation.z = -0.1;
            parts.head.position.y = 2.4 + breath * 0.5;
        }
    }

    // 2. CAMERA FOLLOW & MOVEMENT
    if (cameraRef.current && runnerRef.current) {
        // Smoothly interpolate runner X position
        const targetX = stateRef.current.lane * 5;
        runnerRef.current.position.x += (targetX - runnerRef.current.position.x) * 0.15;

        // Jump physics
        if (stateRef.current.isJumping) {
            runnerRef.current.position.y += stateRef.current.jumpVelocity;
            stateRef.current.jumpVelocity -= 0.02; // Gravity
            
            if (runnerRef.current.position.y <= 0) {
                runnerRef.current.position.y = 0;
                stateRef.current.isJumping = false;
            }
        }

        // Camera Logic: Follow the runner X but smoothed
        // We track ~70% of the runner's X position to keep them visible but dynamic
        const camTargetX = runnerRef.current.position.x * 0.7;
        cameraRef.current.position.x += (camTargetX - cameraRef.current.position.x) * 0.1;
        
        // Tilt camera slightly based on movement for "action" feel
        cameraRef.current.rotation.z = -runnerRef.current.position.x * 0.03;
        
        // Always look somewhat towards the center/runner
        cameraRef.current.lookAt(
            runnerRef.current.position.x * 0.4, 
            1, 
            -20 // Look further ahead
        );
    }

    if (!stateRef.current.isRunning || stateRef.current.isGameOver) return;
    
    // 3. GAMEPLAY LOGIC
    const speed = stateRef.current.speed;

    // Move Environment
    sceneryRef.current.forEach(item => {
        item.position.z += speed;
        if (item.position.z > 20) item.position.z = -1000;
    });

    if (trackRef.current) {
        trackRef.current.position.z += speed;
        if (trackRef.current.position.z > 0) trackRef.current.position.z = -500;
    }

    // Spawn Logic
    if (Math.random() < 0.02) spawnObstacle();
    if (Math.random() < 0.03) spawnCoin();

    // Process Entities
    const scene = sceneRef.current;
    
    // Obstacles
    for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const ob = obstaclesRef.current[i];
        ob.position.z += speed;
        
        // Collision (AABB approx)
        if (ob.position.z > -2 && ob.position.z < 2) {
            const xDist = Math.abs(ob.position.x - runnerRef.current!.position.x);
            // Height check (can we jump over?)
            const runnerY = runnerRef.current!.position.y;
            
            // Obstacle center Y=1, Height=2. Top is Y=2.
            // If runnerY > 2, safe.
            if (xDist < 2 && runnerY < 1.8) {
                playSound(crashSound.current);
                gameOver();
            }
        }

        if (ob.position.z > 10) {
            scene!.remove(ob);
            obstaclesRef.current.splice(i, 1);
        }
    }

    // Coins
    for (let i = coinsRef.current.length - 1; i >= 0; i--) {
        const coin = coinsRef.current[i];
        coin.position.z += speed;
        coin.rotation.y += 0.1;

        if (coin.position.z > -1.5 && coin.position.z < 1.5) {
             const xDist = Math.abs(coin.position.x - runnerRef.current!.position.x);
             const yDist = Math.abs(coin.position.y - runnerRef.current!.position.y - 1);
             if (xDist < 1.5 && yDist < 2.5) {
                 stateRef.current.score += 1;
                 playSound(coinSound.current);
                 scene!.remove(coin);
                 coinsRef.current.splice(i, 1);
                 continue;
             }
        }

        if (coin.position.z > 10) {
            scene!.remove(coin);
            coinsRef.current.splice(i, 1);
        }
    }

    // Update Stats
    stateRef.current.distance += speed;
    if (stateRef.current.speed < 1.2) {
        stateRef.current.speed += 0.0001;
    }

    onUpdateStats({
        score: stateRef.current.score,
        speed: stateRef.current.speed,
        distance: stateRef.current.distance
    });

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const spawnObstacle = () => {
      if (!sceneRef.current) return;
      const lane = Math.floor(Math.random() * 3) - 1; 
      
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshLambertMaterial({ color: 0xe11d48 });
      const obstacle = new THREE.Mesh(geometry, material);
      
      obstacle.position.set(lane * 5, 1, -150); 
      obstacle.castShadow = true;
      
      sceneRef.current.add(obstacle);
      obstaclesRef.current.push(obstacle);
  };

  const spawnCoin = () => {
      if (!sceneRef.current) return;
      const lane = Math.floor(Math.random() * 3) - 1; 
      
      const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      const material = new THREE.MeshPhongMaterial({ 
          color: 0xffd700, 
          emissive: 0xaa4400,
          shininess: 100
      });
      const coin = new THREE.Mesh(geometry, material);
      coin.rotation.x = Math.PI / 2;
      
      coin.position.set(lane * 5, 1.5, -150);
      coin.castShadow = true;

      sceneRef.current.add(coin);
      coinsRef.current.push(coin);
  };

  const gameOver = () => {
      stateRef.current.isRunning = false;
      stateRef.current.isGameOver = true;
      onGameOver(stateRef.current.score);
  };

  useEffect(() => {
    actionRef.current = {
      moveLeft,
      moveRight,
      jump,
      startGame,
      resetGame
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.isRunning || stateRef.current.isGameOver) return;
      
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': moveLeft(); break;
        case 'ArrowRight': case 'KeyD': moveRight(); break;
        case 'ArrowUp': case 'Space': case 'KeyW': jump(); break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}