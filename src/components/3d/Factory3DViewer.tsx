import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
    Layers, Zap, Wind, Droplets, Truck, Eye, RotateCcw, 
    Maximize2, Minimize2, Check, AlertTriangle, Box, Compass,
    Info, Cpu, Ruler, Sparkles, Navigation
} from 'lucide-react';

export interface FloorItem3D {
    id: string;
    machine_id?: string;
    type: 'machine' | 'wall' | 'obstacle' | 'conveyor' | 'safety_zone' | 'door' | 'text' | 'rack' | 'utility' | 'operator';
    shape?: 'rect' | 'circle' | 'polygon';
    points?: number[];
    name: string;
    status?: 'Running' | 'Idle' | 'Offline' | 'Alarm';
    x_cm: number;
    y_cm: number;
    width_cm: number;
    height_cm: number;
    rotation?: number;
    // New factory MEP expansion metadata (optional)
    utility_type?: 'electric' | 'air' | 'water' | 'forklift' | 'pedestrian';
    power_kw?: number;
    air_cfm?: number;
}

export interface FloorPlanArea3D {
    id: string;
    name: string;
    width_cm: number;
    height_cm: number;
    bg_image_url?: string;
}

interface Factory3DViewerProps {
    zone: FloorPlanArea3D;
    items: FloorItem3D[];
    selectedId: string | null;
    onSelectItem: (id: string | null) => void;
    canEdit?: boolean;
}

interface LayerVisibility {
    machines: boolean;
    racks: boolean;
    electric: boolean;
    air: boolean;
    water: boolean;
    traffic: boolean;
    structure: boolean;
}

// Color palette for MEP & industrial systems
const STATUS_COLORS: Record<string, number> = {
    Running: 0x22c55e, // Green
    Idle: 0xeab308,    // Yellow
    Offline: 0x64748b, // Slate
    Alarm: 0xef4444,   // Red
};

export const Factory3DViewer: React.FC<Factory3DViewerProps> = ({
    zone,
    items,
    selectedId,
    onSelectItem,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const meshMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const statusLightsRef = useRef<Array<{ mesh: THREE.Mesh; type: string }>>([]);

    // UI States
    const [layers, setLayers] = useState<LayerVisibility>({
        machines: true,
        racks: true,
        electric: true,
        air: true,
        water: true,
        traffic: true,
        structure: true,
    });
    const [showBOM, setShowBOM] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<FloorItem3D | null>(null);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [viewMode, setViewMode] = useState<'free' | 'top' | 'iso' | 'walk'>('iso');

    // Convert cm to 3D world meters
    const zoneW = (zone.width_cm || 4000) / 100; // in meters
    const zoneH = (zone.height_cm || 3000) / 100; // in meters
    const ceilingHeight = 6.5; // Standard modern industrial factory ceiling height in meters

    // Parse utilities from items
    const parsedItems = useMemo(() => {
        return items.map(item => {
            const lowerName = (item.name || '').toLowerCase();
            let subtype: 'electric' | 'air' | 'water' | 'forklift' | 'pedestrian' | undefined = item.utility_type;
            
            if (!subtype) {
                if (lowerName.includes('power') || lowerName.includes('elect') || lowerName.includes('db') || lowerName.includes('电') || lowerName.includes('msb')) {
                    subtype = 'electric';
                } else if (lowerName.includes('air') || lowerName.includes('compress') || lowerName.includes('气') || lowerName.includes('风')) {
                    subtype = 'air';
                } else if (lowerName.includes('water') || lowerName.includes('cool') || lowerName.includes('水') || lowerName.includes('chiller')) {
                    subtype = 'water';
                } else if (lowerName.includes('forklift') || lowerName.includes('aisle') || lowerName.includes('path') || lowerName.includes('路') || lowerName.includes('道')) {
                    subtype = 'forklift';
                }
            }

            // Estimate power KW if it's a machine
            let estimatedKw = item.power_kw;
            if (!estimatedKw && item.type === 'machine') {
                if (lowerName.includes('extruder') || lowerName.includes('bubblewrap') || lowerName.includes('film')) {
                    estimatedKw = 45;
                } else if (lowerName.includes('rewind') || lowerName.includes('slit')) {
                    estimatedKw = 15;
                } else if (lowerName.includes('mixer')) {
                    estimatedKw = 11;
                } else {
                    estimatedKw = 7.5;
                }
            }

            return {
                ...item,
                utility_type: subtype,
                power_kw: estimatedKw,
            };
        });
    }, [items]);

    // Calculate BOM summary for relocation
    const bomSummary = useMemo(() => {
        let totalPowerKw = 0;
        let machineCount = 0;
        let rackCount = 0;
        let electricMeters = 0;
        let airMeters = 0;
        let waterMeters = 0;
        let trafficMeters = 0;

        parsedItems.forEach(item => {
            if (item.type === 'machine') {
                machineCount++;
                totalPowerKw += (item.power_kw || 0);
            } else if (item.type === 'rack') {
                rackCount++;
            } else if (item.type === 'utility' || item.type === 'conveyor') {
                const len = ((item.width_cm || 0) + (item.height_cm || 0)) / 100;
                if (item.utility_type === 'electric') electricMeters += len;
                else if (item.utility_type === 'air') airMeters += len;
                else if (item.utility_type === 'water') waterMeters += len;
                else trafficMeters += len;
            }
        });

        // Add auto-generated main ring perimeter estimates if none drawn yet
        if (airMeters === 0) airMeters = Math.round((zoneW + zoneH) * 1.5);
        if (electricMeters === 0) electricMeters = Math.round((zoneW + zoneH) * 1.2);
        if (waterMeters === 0) waterMeters = Math.round(zoneW * 0.8);

        return {
            totalAreaSqM: Math.round(zoneW * zoneH),
            machineCount,
            rackCount,
            totalPowerKw,
            electricMeters,
            airMeters,
            waterMeters,
            trafficMeters,
        };
    }, [parsedItems, zoneW, zoneH]);

    // -------------------------------------------------------------------------
    // Initialize Three.js Scene
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // 1. Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a); // Slate-900 industrial dark theme
        scene.fog = new THREE.FogExp2(0x0f172a, 0.008);
        sceneRef.current = scene;

        // 2. Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500);
        const dist = Math.max(zoneW, zoneH) * 1.2;
        camera.position.set(dist * 0.7, dist * 0.8, dist * 0.9);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // 3. Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // 4. Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't dip below floor
        controls.minDistance = 3;
        controls.maxDistance = dist * 2.5;
        controlsRef.current = controls;

        // 5. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
        dirLight.position.set(dist * 0.5, dist * 0.9, dist * 0.4);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = dist * 3;
        const d = dist * 0.8;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0005;
        scene.add(dirLight);

        const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.4);
        scene.add(hemiLight);

        // 6. Ground & Concrete Floor
        const floorGeo = new THREE.PlaneGeometry(zoneW, zoneH);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.6,
            metalness: 0.2,
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        scene.add(floorMesh);

        // Ground Grid (1-meter units)
        const gridHelper = new THREE.GridHelper(Math.max(zoneW, zoneH), Math.max(zoneW, zoneH), 0x38bdf8, 0x334155);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);

        // Building Boundary Wall Frame (Translucent)
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            transparent: true,
            opacity: 0.25,
            roughness: 0.8,
            wireframe: false,
        });

        // 4 boundary perimeter low walls
        const wallThickness = 0.3;
        const wallH = 3.5;
        // North & South
        const hWallGeo = new THREE.BoxGeometry(zoneW + wallThickness * 2, wallH, wallThickness);
        const northWall = new THREE.Mesh(hWallGeo, wallMat);
        northWall.position.set(0, wallH / 2, -zoneH / 2 - wallThickness / 2);
        const southWall = new THREE.Mesh(hWallGeo, wallMat);
        southWall.position.set(0, wallH / 2, zoneH / 2 + wallThickness / 2);
        // East & West
        const vWallGeo = new THREE.BoxGeometry(wallThickness, wallH, zoneH);
        const westWall = new THREE.Mesh(vWallGeo, wallMat);
        westWall.position.set(-zoneW / 2 - wallThickness / 2, wallH / 2, 0);
        const eastWall = new THREE.Mesh(vWallGeo, wallMat);
        eastWall.position.set(zoneW / 2 + wallThickness / 2, wallH / 2, 0);
        
        const boundaryGroup = new THREE.Group();
        boundaryGroup.name = 'structure_boundary';
        boundaryGroup.add(northWall, southWall, westWall, eastWall);
        scene.add(boundaryGroup);

        // Roof Trusses & Girders (Steel structure aesthetic)
        const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
        const trussCount = Math.max(3, Math.floor(zoneH / 10));
        const trussGroup = new THREE.Group();
        trussGroup.name = 'structure_trusses';
        for (let i = 0; i <= trussCount; i++) {
            const zPos = -zoneH / 2 + (zoneH / trussCount) * i;
            const beam = new THREE.Mesh(new THREE.BoxGeometry(zoneW, 0.35, 0.35), trussMat);
            beam.position.set(0, ceilingHeight, zPos);
            trussGroup.add(beam);
        }
        scene.add(trussGroup);

        // Resize Listener
        const handleResize = () => {
            if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // Animation Loop
        let clock = new THREE.Clock();
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            // Status light pulsing
            statusLightsRef.current.forEach(({ mesh, type }) => {
                const material = mesh.material as THREE.MeshBasicMaterial;
                if (type === 'Alarm') {
                    // Fast warning flash
                    material.opacity = (Math.sin(elapsedTime * 10) + 1) / 2 * 0.8 + 0.2;
                } else if (type === 'Running') {
                    // Gentle breathing pulse
                    material.opacity = (Math.sin(elapsedTime * 2.5) + 1) / 2 * 0.4 + 0.6;
                }
            });

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            renderer.dispose();
            controls.dispose();
            container.innerHTML = '';
        };
    }, [zone.id, zoneW, zoneH]);

    // -------------------------------------------------------------------------
    // Rebuild Scene Objects when items or layers change
    // -------------------------------------------------------------------------
    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Clear previous item meshes
        meshMapRef.current.forEach((obj) => scene.remove(obj));
        meshMapRef.current.clear();
        statusLightsRef.current = [];

        // Dynamic MEP Main Loops (If relocation mode: air, electric, water loops)
        const mepGroup = new THREE.Group();
        mepGroup.name = 'mep_pipelines';

        // 1. Air Ring Main (Blue suspended pipe at 4.0m)
        if (layers.air) {
            const airH = 4.0;
            const margin = 2.0;
            const airPoints = [
                new THREE.Vector3(-zoneW / 2 + margin, airH, -zoneH / 2 + margin),
                new THREE.Vector3(zoneW / 2 - margin, airH, -zoneH / 2 + margin),
                new THREE.Vector3(zoneW / 2 - margin, airH, zoneH / 2 - margin),
                new THREE.Vector3(-zoneW / 2 + margin, airH, zoneH / 2 - margin),
                new THREE.Vector3(-zoneW / 2 + margin, airH, -zoneH / 2 + margin),
            ];
            const airCurve = new THREE.CatmullRomCurve3(airPoints, true, 'catmullrom', 0.05);
            const airTubeGeo = new THREE.TubeGeometry(airCurve, 64, 0.08, 8, true);
            const airMat = new THREE.MeshStandardMaterial({
                color: 0x0284c7, // Sky-600 compressed air blue
                metalness: 0.5,
                roughness: 0.3,
            });
            const airMesh = new THREE.Mesh(airTubeGeo, airMat);
            airMesh.castShadow = true;
            mepGroup.add(airMesh);
        }

        // 2. Power Cable Tray (Yellow overhead busway at 4.6m)
        if (layers.electric) {
            const elecH = 4.6;
            const trayW = 0.4;
            const trayH = 0.15;
            const trayMat = new THREE.MeshStandardMaterial({
                color: 0xeab308, // Warning yellow
                metalness: 0.6,
                roughness: 0.4,
            });

            // Longitudinal main busduct down the central aisle
            const trayGeo = new THREE.BoxGeometry(trayW, trayH, zoneH * 0.85);
            const trayMesh = new THREE.Mesh(trayGeo, trayMat);
            trayMesh.position.set(0, elecH, 0);
            mepGroup.add(trayMesh);

            // Distribution Panel (Main Switchboard MSB) by the wall
            const msbGeo = new THREE.BoxGeometry(1.2, 2.2, 0.6);
            const msbMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.8, roughness: 0.2 });
            const msbMesh = new THREE.Mesh(msbGeo, msbMat);
            msbMesh.position.set(-zoneW / 2 + 1.5, 1.1, -zoneH / 2 + 1.0);
            mepGroup.add(msbMesh);
        }

        // 3. Forklift Arterial Aisle (Ground level high-vis yellow zebra lines)
        if (layers.traffic) {
            const aisleWidth = 3.2; // Standard 3.2m forklift clearance
            const aisleGeo = new THREE.PlaneGeometry(aisleWidth, zoneH * 0.9);
            const aisleMat = new THREE.MeshStandardMaterial({
                color: 0x334155,
                roughness: 0.9,
            });
            const aisleMesh = new THREE.Mesh(aisleGeo, aisleMat);
            aisleMesh.rotation.x = -Math.PI / 2;
            aisleMesh.position.set(0, 0.015, 0);
            mepGroup.add(aisleMesh);

            // Border warning lines
            const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const line1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, zoneH * 0.9), lineMat);
            line1.rotation.x = -Math.PI / 2;
            line1.position.set(-aisleWidth / 2, 0.02, 0);
            const line2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, zoneH * 0.9), lineMat);
            line2.rotation.x = -Math.PI / 2;
            line2.position.set(aisleWidth / 2, 0.02, 0);
            mepGroup.add(line1, line2);
        }

        scene.add(mepGroup);
        meshMapRef.current.set('mep_pipelines', mepGroup);

        // ---------------------------------------------------------------------
        // Populate Database Items (Machines, Racks, Obstacles, Walls)
        // ---------------------------------------------------------------------
        parsedItems.forEach((item) => {
            // Coordinate transformation: cm to 3D center origin meters
            const itemW = (item.width_cm || 100) / 100;
            const itemD = (item.height_cm || 100) / 100; // 2D height becomes 3D depth (Z)
            const posX = (item.x_cm - zone.width_cm / 2) / 100 + itemW / 2;
            const posZ = (item.y_cm - zone.height_cm / 2) / 100 + itemD / 2;
            const rotY = -((item.rotation || 0) * Math.PI) / 180;

            const isSelected = item.id === selectedId;

            // 1. MACHINES
            if (item.type === 'machine' && layers.machines) {
                const group = new THREE.Group();
                group.position.set(posX, 0, posZ);
                group.rotation.y = rotY;

                const machineH = Math.min(2.5, Math.max(1.4, itemW * 0.5));

                // Machine Main Chassis
                const bodyGeo = new THREE.BoxGeometry(itemW, machineH, itemD);
                const bodyMat = new THREE.MeshStandardMaterial({
                    color: isSelected ? 0x38bdf8 : 0x475569, // Sky highlight if selected
                    metalness: 0.5,
                    roughness: 0.4,
                });
                const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
                bodyMesh.position.y = machineH / 2;
                bodyMesh.castShadow = true;
                bodyMesh.receiveShadow = true;
                bodyMesh.userData = { itemId: item.id };
                group.add(bodyMesh);

                // Machine Control Terminal Screen
                const screenGeo = new THREE.BoxGeometry(itemW * 0.3, machineH * 0.25, 0.1);
                const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
                const screenMesh = new THREE.Mesh(screenGeo, screenMat);
                screenMesh.position.set(0, machineH * 0.8, itemD / 2 + 0.05);
                group.add(screenMesh);

                // Top Status Beacon / Breathing Light Pillar
                const beaconH = 0.5;
                const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, beaconH, 12);
                const beaconColor = STATUS_COLORS[item.status || 'Offline'] || 0x64748b;
                const beaconMat = new THREE.MeshBasicMaterial({
                    color: beaconColor,
                    transparent: true,
                    opacity: 0.85,
                });
                const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
                beaconMesh.position.set(itemW / 2 - 0.25, machineH + beaconH / 2, itemD / 2 - 0.25);
                group.add(beaconMesh);
                statusLightsRef.current.push({ mesh: beaconMesh, type: item.status || 'Offline' });

                // MEP Drop Lines (Vertical Power & Air Down to machine)
                if (layers.air) {
                    const airDropGeo = new THREE.CylinderGeometry(0.025, 0.025, 4.0 - machineH, 8);
                    const airDropMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
                    const airDropMesh = new THREE.Mesh(airDropGeo, airDropMat);
                    airDropMesh.position.set(itemW / 2 - 0.2, machineH + (4.0 - machineH) / 2, -itemD / 2 + 0.2);
                    group.add(airDropMesh);
                }
                if (layers.electric) {
                    const elecDropGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.6 - machineH, 8);
                    const elecDropMat = new THREE.MeshStandardMaterial({ color: 0xeab308 });
                    const elecDropMesh = new THREE.Mesh(elecDropGeo, elecDropMat);
                    elecDropMesh.position.set(-itemW / 2 + 0.2, machineH + (4.6 - machineH) / 2, -itemD / 2 + 0.2);
                    group.add(elecDropMesh);
                }

                scene.add(group);
                meshMapRef.current.set(item.id, group);
            }

            // 2. WAREHOUSE STORAGE RACKS
            else if (item.type === 'rack' && layers.racks) {
                const group = new THREE.Group();
                group.position.set(posX, 0, posZ);
                group.rotation.y = rotY;

                const rackHeight = 4.2; // 4-tier high bay rack
                const uprightMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.6, roughness: 0.3 }); // Industrial blue
                const beamMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.5, roughness: 0.4 });    // Safety orange
                const cargoMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 }); // Cardboard/pallet

                // 4 vertical corner posts
                const postThick = 0.08;
                const postGeo = new THREE.BoxGeometry(postThick, rackHeight, postThick);
                const p1 = new THREE.Mesh(postGeo, uprightMat); p1.position.set(-itemW / 2, rackHeight / 2, -itemD / 2);
                const p2 = new THREE.Mesh(postGeo, uprightMat); p2.position.set(itemW / 2, rackHeight / 2, -itemD / 2);
                const p3 = new THREE.Mesh(postGeo, uprightMat); p3.position.set(-itemW / 2, rackHeight / 2, itemD / 2);
                const p4 = new THREE.Mesh(postGeo, uprightMat); p4.position.set(itemW / 2, rackHeight / 2, itemD / 2);
                group.add(p1, p2, p3, p4);

                // 4 Horizontal beam levels
                for (let level = 1; level <= 4; level++) {
                    const levelY = (rackHeight / 4) * level;
                    const b1 = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.08, 0.06), beamMat);
                    b1.position.set(0, levelY, itemD / 2);
                    const b2 = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.08, 0.06), beamMat);
                    b2.position.set(0, levelY, -itemD / 2);
                    group.add(b1, b2);

                    // Add simulated pallets/goods on lower 2 tiers
                    if (level <= 2) {
                        const boxGeo = new THREE.BoxGeometry(itemW * 0.7, 0.6, itemD * 0.7);
                        const boxMesh = new THREE.Mesh(boxGeo, cargoMat);
                        boxMesh.position.set(0, levelY - 0.35, 0);
                        boxMesh.castShadow = true;
                        group.add(boxMesh);
                    }
                }

                group.userData = { itemId: item.id };
                scene.add(group);
                meshMapRef.current.set(item.id, group);
            }

            // 3. PILLARS / OBSTACLES (tiang)
            else if ((item.type === 'obstacle' || item.name.toLowerCase().includes('tiang')) && layers.structure) {
                const pillarGeo = new THREE.BoxGeometry(itemW, ceilingHeight, itemD);
                const pillarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.2, roughness: 0.7 });
                const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
                pillarMesh.position.set(posX, ceilingHeight / 2, posZ);
                pillarMesh.castShadow = true;
                pillarMesh.userData = { itemId: item.id };
                scene.add(pillarMesh);
                meshMapRef.current.set(item.id, pillarMesh);
            }

            // 4. WALLS & PARTITIONS
            else if (item.type === 'wall' && layers.structure) {
                const wallH = 3.5;
                const wallGeo = new THREE.BoxGeometry(itemW, wallH, itemD);
                const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.1, roughness: 0.9 });
                const wallMesh = new THREE.Mesh(wallGeo, wallMat);
                wallMesh.position.set(posX, wallH / 2, posZ);
                wallMesh.rotation.y = rotY;
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                wallMesh.userData = { itemId: item.id };
                scene.add(wallMesh);
                meshMapRef.current.set(item.id, wallMesh);
            }

            // 5. SAFETY ZONES & WALKWAYS
            else if (item.type === 'safety_zone' && layers.traffic) {
                const safetyGeo = new THREE.PlaneGeometry(itemW, itemD);
                const safetyMat = new THREE.MeshStandardMaterial({
                    color: 0x10b981, // Safe green
                    transparent: true,
                    opacity: 0.6,
                });
                const safetyMesh = new THREE.Mesh(safetyGeo, safetyMat);
                safetyMesh.rotation.x = -Math.PI / 2;
                safetyMesh.position.set(posX, 0.02, posZ);
                safetyMesh.userData = { itemId: item.id };
                scene.add(safetyMesh);
                meshMapRef.current.set(item.id, safetyMesh);
            }
        });
    }, [parsedItems, layers, selectedId, zone.width_cm, zone.height_cm, zoneW, zoneH]);

    // -------------------------------------------------------------------------
    // Raycasting for Mouse Hover & Selection
    // -------------------------------------------------------------------------
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(sceneRef.current.children, true);

        for (const hit of intersects) {
            let curr: THREE.Object3D | null = hit.object;
            while (curr && !curr.userData?.itemId && curr.parent) {
                curr = curr.parent;
            }
            if (curr && curr.userData?.itemId) {
                onSelectItem(curr.userData.itemId);
                return;
            }
        }
        onSelectItem(null);
    }, [onSelectItem]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObjects(sceneRef.current.children, true);

        for (const hit of intersects) {
            let curr: THREE.Object3D | null = hit.object;
            while (curr && !curr.userData?.itemId && curr.parent) {
                curr = curr.parent;
            }
            if (curr && curr.userData?.itemId) {
                const found = parsedItems.find(i => i.id === curr?.userData.itemId);
                if (found) {
                    setHoveredItem(found);
                    return;
                }
            }
        }
        setHoveredItem(null);
    }, [parsedItems]);

    // -------------------------------------------------------------------------
    // Camera View Presets
    // -------------------------------------------------------------------------
    const setPresetView = (mode: 'top' | 'iso' | 'walk') => {
        if (!cameraRef.current || !controlsRef.current) return;
        const cam = cameraRef.current;
        const ctrl = controlsRef.current;
        const dist = Math.max(zoneW, zoneH);

        setViewMode(mode);
        if (mode === 'top') {
            cam.position.set(0, dist * 1.5, 0.01);
            ctrl.target.set(0, 0, 0);
        } else if (mode === 'iso') {
            cam.position.set(dist * 0.7, dist * 0.8, dist * 0.9);
            ctrl.target.set(0, 0, 0);
        } else if (mode === 'walk') {
            cam.position.set(0, 1.7, dist * 0.4); // Human eye level 1.7m
            ctrl.target.set(0, 1.7, 0);
        }
        ctrl.update();
    };

    return (
        <div className="relative w-full h-full min-h-[620px] bg-slate-950 overflow-hidden select-none font-sans">
            {/* 3D WebGL Canvas Container */}
            <div 
                ref={containerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
            />

            {/* Top-Left: Zone Info & Viewport HUD */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-4 py-3 rounded-xl shadow-2xl text-white">
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h2 className="text-base font-bold tracking-wide">{zone.name || 'Factory 3D Space'}</h2>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Digital Twin 3D
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5 font-mono">
                        <span>{zoneW}m × {zoneH}m</span>
                        <span>•</span>
                        <span>{bomSummary.totalAreaSqM} m²</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{bomSummary.machineCount} 机台落位</span>
                        <span>•</span>
                        <span className="text-blue-400 font-semibold">{bomSummary.rackCount} 组立体货架</span>
                    </div>
                </div>

                {/* View Preset Buttons */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/70 p-1.5 rounded-xl shadow-lg w-fit">
                    <button
                        onClick={() => setPresetView('iso')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            viewMode === 'iso' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                    >
                        <Compass className="w-3.5 h-3.5" />
                        45° 轴侧
                    </button>
                    <button
                        onClick={() => setPresetView('top')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            viewMode === 'top' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        俯视鸟瞰
                    </button>
                    <button
                        onClick={() => setPresetView('walk')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            viewMode === 'walk' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                    >
                        <Navigation className="w-3.5 h-3.5" />
                        巡检人视
                    </button>
                </div>
            </div>

            {/* Top-Right: Layer Visibility Controls (MEP 水电风动线开关) */}
            <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-2xl text-white w-64">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                            <Layers className="w-4 h-4 text-blue-400" />
                            <span>水电风与动线图层 (MEP)</span>
                        </div>
                        <span className="text-[10px] text-slate-500">按需过滤</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-xs">
                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                            <span className="flex items-center gap-2 text-slate-300">
                                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                                ⚡ 电力桥架 (4.6m)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={layers.electric} 
                                onChange={e => setLayers(l => ({ ...l, electric: e.target.checked }))}
                                className="rounded border-slate-600 text-yellow-500 focus:ring-0" 
                            />
                        </label>

                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                            <span className="flex items-center gap-2 text-slate-300">
                                <Wind className="w-3.5 h-3.5 text-sky-400" />
                                💨 压缩空气管网 (4.0m)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={layers.air} 
                                onChange={e => setLayers(l => ({ ...l, air: e.target.checked }))}
                                className="rounded border-slate-600 text-sky-500 focus:ring-0" 
                            />
                        </label>

                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                            <span className="flex items-center gap-2 text-slate-300">
                                <Truck className="w-3.5 h-3.5 text-amber-400" />
                                🚚 叉车主干道 (3.2m)
                            </span>
                            <input 
                                type="checkbox" 
                                checked={layers.traffic} 
                                onChange={e => setLayers(l => ({ ...l, traffic: e.target.checked }))}
                                className="rounded border-slate-600 text-amber-500 focus:ring-0" 
                            />
                        </label>

                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                            <span className="flex items-center gap-2 text-slate-300">
                                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                                🏭 生产机台设备
                            </span>
                            <input 
                                type="checkbox" 
                                checked={layers.machines} 
                                onChange={e => setLayers(l => ({ ...l, machines: e.target.checked }))}
                                className="rounded border-slate-600 text-emerald-500 focus:ring-0" 
                            />
                        </label>

                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                            <span className="flex items-center gap-2 text-slate-300">
                                <Box className="w-3.5 h-3.5 text-indigo-400" />
                                📦 立体货架库位
                            </span>
                            <input 
                                type="checkbox" 
                                checked={layers.racks} 
                                onChange={e => setLayers(l => ({ ...l, racks: e.target.checked }))}
                                className="rounded border-slate-600 text-indigo-500 focus:ring-0" 
                            />
                        </label>

                        <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer">
                            <span className="flex items-center gap-2 text-slate-300">
                                <Ruler className="w-3.5 h-3.5 text-slate-400" />
                                🧱 厂房墙体与立柱
                            </span>
                            <input 
                                type="checkbox" 
                                checked={layers.structure} 
                                onChange={e => setLayers(l => ({ ...l, structure: e.target.checked }))}
                                className="rounded border-slate-600 text-slate-500 focus:ring-0" 
                            />
                        </label>
                    </div>

                    <button 
                        onClick={() => setShowBOM(b => !b)}
                        className="mt-3 w-full py-1.5 px-3 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-blue-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        {showBOM ? '收起搬厂算料清单' : '查看搬厂管线算料 (BOM)'}
                    </button>
                </div>

                {/* Relocation BOM Engineering Estimation Card */}
                {showBOM && (
                    <div className="bg-slate-900/95 backdrop-blur-md border border-blue-500/40 p-4 rounded-xl shadow-2xl text-white w-72 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                            <h3 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                                <Ruler className="w-4 h-4" />
                                搬厂管线工程量估算 (BOM)
                            </h3>
                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">交底核算</span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between items-center bg-slate-800/40 p-2 rounded-lg">
                                <span className="text-slate-400">⚡ 动力桥架/母线槽：</span>
                                <span className="font-mono font-bold text-yellow-400">{bomSummary.electricMeters} 米</span>
                            </div>

                            <div className="flex justify-between items-center bg-slate-800/40 p-2 rounded-lg">
                                <span className="text-slate-400">💨 空压主管环网：</span>
                                <span className="font-mono font-bold text-sky-400">{bomSummary.airMeters} 米</span>
                            </div>

                            <div className="flex justify-between items-center bg-slate-800/40 p-2 rounded-lg">
                                <span className="text-slate-400">💧 循环冷却水管：</span>
                                <span className="font-mono font-bold text-emerald-400">{bomSummary.waterMeters} 米</span>
                            </div>

                            <div className="flex justify-between items-center bg-slate-800/40 p-2 rounded-lg">
                                <span className="text-slate-400">🔌 机台装机总功率：</span>
                                <span className="font-mono font-bold text-orange-400">~{bomSummary.totalPowerKw} kW</span>
                            </div>

                            <div className="text-[10px] text-slate-400 pt-1 leading-relaxed border-t border-slate-800">
                                💡 提示：该数据根据 3D 几何与机台点位自动求和，可直接用于采购母线槽、镀锌管及施工承包商报价复核。
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Hover Tooltip (Raycasting) */}
            {hoveredItem && (
                <div 
                    className="absolute z-20 pointer-events-none bg-slate-900/90 backdrop-blur-md border border-blue-400/50 px-3 py-2 rounded-lg shadow-xl text-white text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                    style={{ left: cursorPos.x, top: cursorPos.y }}
                >
                    <div className="font-bold text-blue-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        {hoveredItem.name || hoveredItem.type}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1 font-mono">
                        尺寸: {(hoveredItem.width_cm / 100).toFixed(1)}m × {(hoveredItem.height_cm / 100).toFixed(1)}m
                    </div>
                    {hoveredItem.type === 'machine' && (
                        <div className="text-[11px] text-yellow-300 font-mono">
                            预估功率: {hoveredItem.power_kw || 15} kW
                        </div>
                    )}
                </div>
            )}

            {/* Bottom-Center: Selected Item Quick Inspector */}
            {selectedId && (() => {
                const item = parsedItems.find(i => i.id === selectedId);
                if (!item) return null;
                return (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-6 py-3 rounded-2xl shadow-2xl text-white flex items-center gap-6">
                        <div>
                            <div className="text-xs text-slate-400">选中物件</div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                {item.name || item.id}
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                    item.status === 'Running' ? 'bg-emerald-500/20 text-emerald-400' :
                                    item.status === 'Alarm' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {item.status || 'Active'}
                                </span>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-slate-800" />

                        <div className="font-mono text-xs text-slate-300">
                            <div>X: {(item.x_cm / 100).toFixed(2)}m, Y: {(item.y_cm / 100).toFixed(2)}m</div>
                            <div className="text-slate-400">占地: {((item.width_cm * item.height_cm) / 10000).toFixed(2)} m²</div>
                        </div>

                        {item.type === 'machine' && (
                            <>
                                <div className="h-8 w-px bg-slate-800" />
                                <div className="text-xs">
                                    <div className="text-slate-400">动力与气动配置</div>
                                    <div className="text-yellow-400 font-mono font-bold">~{item.power_kw || 15} kW | 6 bar</div>
                                </div>
                            </>
                        )}

                        <button 
                            onClick={() => onSelectItem(null)}
                            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                        >
                            关闭
                        </button>
                    </div>
                );
            })()}

            {/* Bottom-Right: Manipulation Controls Tips */}
            <div className="absolute bottom-4 right-4 z-10 text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-3">
                <span>🖱️ <b>左键拖拽</b>：旋转视角</span>
                <span>•</span>
                <span><b>滚轮</b>：缩放</span>
                <span>•</span>
                <span><b>右键拖拽</b>：平移</span>
            </div>
        </div>
    );
};

export default Factory3DViewer;
