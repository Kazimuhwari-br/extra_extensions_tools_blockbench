(function () {
	const PLUGIN_ID = "extra_extensions_tools";

	// ===========================
	// 
	// ===========================
/* TESTE 1
	function openTestDialog() {
		const dialog = new Dialog({
			id: "filled_fusion_surface_dialog",
			title: "Generate Fusion Surface Between Cubes",
			form: {
				density_mode: {
					label: "Densidade",
					type: "select",
					options: {
						low: "Baixa",
						medium: "Média",
						high: "Alta",
						sealed: "Sem buracos"
					},
					value: "medium"
				},
				use_custom_density: {
					label: "Usar multiplicador manual",
					type: "checkbox",
					value: false
				},
				custom_density: {
					label: "Multiplicador manual",
					type: "number",
					value: 1,
					min: 0.25,
					max: 5,
					step: 0.1
				},
				thickness_mult: {
					label: "Multiplicador de espessura",
					type: "number",
					value: 1,
					min: 0.1,
					max: 5,
					step: 0.1
				},
				close_poles: {
					label: "Fechar polos",
					type: "checkbox",
					value: true
				},
				fusion_strength: {
					label: "Força da fusão",
					type: "number",
					value: 1.35,
					min: 0.5,
					max: 3,
					step: 0.05
				},
				length_steps_mult: {
					label: "Multiplicador de camadas",
					type: "number",
					value: 1,
					min: 0.25,
					max: 4,
					step: 0.1
				}
			},
			buttons: ["OK", "Cancelar"],
			onConfirm(data) {
				dialog.hide();
				generateFusionSurface(data);
			}
		});

		dialog.show();
	}

	function generateFusionSurface(options = {}) {
		const sel = Cube.selected.filter(c => c instanceof Cube);
		if (sel.length < 2) {
			Blockbench.showQuickMessage("Selecione 2 cubos: origem e destino.");
			return;
		}

		const base = sel[0];
		const target = sel[1];
		const parent = base.parent;
		const created = [];

		const degToRad = d => d * Math.PI / 180;
		const radToDeg = r => r * 180 / Math.PI;

		function getCubeCenter(c) {
			return [
				(c.from[0] + c.to[0]) / 2,
				(c.from[1] + c.to[1]) / 2,
				(c.from[2] + c.to[2]) / 2
			];
		}

		function dist(a, b) {
			const dx = a[0] - b[0];
			const dy = a[1] - b[1];
			const dz = a[2] - b[2];
			return Math.sqrt(dx * dx + dy * dy + dz * dz);
		}

		function lerp(a, b, t) {
			return a + (b - a) * t;
		}

		function smoothstep(t) {
			return t * t * (3 - 2 * t);
		}

		function cloneFaces(to, from) {
			if (!from.faces || !to.faces) return;

			const props = [
				"uv",
				"rotation",
				"texture",
				"cullface",
				"tint",
				"enabled",
				"material_name"
			];

			for (const key in from.faces) {
				if (!to.faces[key] || !from.faces[key]) continue;
				for (const prop of props) {
					if (from.faces[key][prop] !== undefined) {
						const value = from.faces[key][prop];
						to.faces[key][prop] = Array.isArray(value) ? value.slice() : value;
					}
				}
			}
		}

		function makeEllipsoidFace(base, center, radiusX, radiusY, radiusZ, pitchDeg, yawDeg, faceW, faceH, thickness) {
			const pitch = degToRad(pitchDeg);
			const yaw = degToRad(yawDeg);

			const sx = Math.cos(pitch) * Math.cos(yaw);
			const sy = Math.sin(pitch);
			const sz = Math.cos(pitch) * Math.sin(yaw);

			const px = center[0] + sx * radiusX;
			const py = center[1] + sy * radiusY;
			const pz = center[2] + sz * radiusZ;

			const nx = sx / Math.max(radiusX, 0.0001);
			const ny = sy / Math.max(radiusY, 0.0001);
			const nz = sz / Math.max(radiusZ, 0.0001);

			const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
			const nnx = nx / nLen;
			const nny = ny / nLen;
			const nnz = nz / nLen;

			const horiz = Math.sqrt(nnx * nnx + nnz * nnz);

			const rotX = -radToDeg(Math.atan2(nny, horiz));
			const rotY = radToDeg(Math.atan2(nnx, nnz));
			const rotZ = 0;

			const cube = new Cube({
				name: "Fusion Face",
				from: [
					px - faceW / 2,
					py - faceH / 2,
					pz - thickness / 2
				],
				to: [
					px + faceW / 2,
					py + faceH / 2,
					pz + thickness / 2
				],
				origin: [px, py, pz],
				rotation: [rotX, rotY, rotZ],
				color: base.color,
				autouv: base.autouv,
				mirror_uv: base.mirror_uv || false,
				inflate: 0
			});

			cloneFaces(cube, base);
			return cube;
		}

		const start = getCubeCenter(base);
		const end = getCubeCenter(target);

		const totalLength = dist(start, end);
		if (totalLength < 0.001) {
			Blockbench.showQuickMessage("Os cubos estão no mesmo ponto.");
			return;
		}

		const baseSizeX = Math.abs(base.to[0] - base.from[0]);
		const baseSizeY = Math.abs(base.to[1] - base.from[1]);
		const baseSizeZ = Math.abs(base.to[2] - base.from[2]);

		const targetSizeX = Math.abs(target.to[0] - target.from[0]);
		const targetSizeY = Math.abs(target.to[1] - target.from[1]);
		const targetSizeZ = Math.abs(target.to[2] - target.from[2]);

		const baseRadius = {
			x: Math.max(baseSizeX / 2, 0.0001),
			y: Math.max(baseSizeY / 2, 0.0001),
			z: Math.max(baseSizeZ / 2, 0.0001)
		};

		const targetRadius = {
			x: Math.max(targetSizeX / 2, 0.0001),
			y: Math.max(targetSizeY / 2, 0.0001),
			z: Math.max(targetSizeZ / 2, 0.0001)
		};

		const faceW = Math.max(Math.min(baseSizeX, baseSizeZ) * 0.35, 1);
		const faceH = Math.max(baseSizeY * 0.35, 1);

		const densityPresets = {
			low:    { vertical: 1.20, horizontal: 1.15, minRing: 6, poleLimit: 0.28 },
			medium: { vertical: 0.90, horizontal: 0.92, minRing: 8, poleLimit: 0.35 },
			high:   { vertical: 0.72, horizontal: 0.78, minRing: 10, poleLimit: 0.42 },
			sealed: { vertical: 0.58, horizontal: 0.62, minRing: 12, poleLimit: 0.50 }
		};

		const selectedPreset = densityPresets[options.density_mode || "medium"] || densityPresets.medium;
		const densityMultiplier = options.use_custom_density ? Math.max(options.custom_density || 1, 0.1) : 1;

		const verticalFactor = selectedPreset.vertical / densityMultiplier;
		const horizontalFactor = selectedPreset.horizontal / densityMultiplier;
		const minRingCount = Math.max(4, Math.round(selectedPreset.minRing * densityMultiplier));
		const poleLimit = selectedPreset.poleLimit;

		const thicknessBase = Math.min(Math.max(baseSizeZ * 0.05, 0.02), 0.1);
		const thickness = thicknessBase * Math.max(options.thickness_mult || 1, 0.1);

		const closePoles = options.close_poles !== false;
		const fusionStrength = Math.max(options.fusion_strength || 1.35, 0.1);
		const lengthStepsMult = Math.max(options.length_steps_mult || 1, 0.1);

		const avgRadiusY = (baseRadius.y + targetRadius.y) * 0.5;
		const pitchStepRad = (faceH * verticalFactor) / Math.max(avgRadiusY, 0.0001);
		let pitchStepDeg = radToDeg(pitchStepRad);
		pitchStepDeg = Math.max(2, Math.min(18, pitchStepDeg));

		const steps = Math.max(2, Math.ceil((totalLength / Math.max(faceH, 0.001)) * lengthStepsMult));

		const used = new Set();
		const key = (x, y, z, a, b) =>
			`${Math.round(x * 20)}/${Math.round(y * 20)}/${Math.round(z * 20)}/${Math.round(a * 10)}/${Math.round(b * 10)}`;

		Undo.initEdit({ elements: created, outliner: true, selection: true });

		for (let s = 0; s <= steps; s++) {
			const rawT = s / steps;
			const t = smoothstep(rawT);

			const center = [
				lerp(start[0], end[0], t),
				lerp(start[1], end[1], t),
				lerp(start[2], end[2], t)
			];

			const blendRX = lerp(baseRadius.x, targetRadius.x, t);
			const blendRY = lerp(baseRadius.y, targetRadius.y, t);
			const blendRZ = lerp(baseRadius.z, targetRadius.z, t);

			const bulge = Math.sin(rawT * Math.PI);
			const fusionScale = 1 + (fusionStrength - 1) * bulge;

			const radiusX = Math.max(blendRX * fusionScale, 0.0001);
			const radiusY = Math.max(blendRY * fusionScale, 0.0001);
			const radiusZ = Math.max(blendRZ * fusionScale, 0.0001);

			for (let pitch = -90; pitch <= 90; pitch += pitchStepDeg) {
				const pitchRad = degToRad(pitch);

				const ringRadiusX = Math.abs(Math.cos(pitchRad) * radiusX);
				const ringRadiusZ = Math.abs(Math.cos(pitchRad) * radiusZ);
				const ringRadius = (ringRadiusX + ringRadiusZ) / 2;

				if (closePoles && ringRadius < faceW * poleLimit) {
					const k = key(center[0], center[1], center[2], pitch, 0);
					if (!used.has(k)) {
						const cube = makeEllipsoidFace(
							base,
							center,
							radiusX,
							radiusY,
							radiusZ,
							pitch,
							0,
							faceW,
							faceH,
							thickness
						);

						if (Math.abs(pitch) > 85) cube.name = "Fusion Pole";

						cube.addTo(parent);
						cube.init();
						created.push(cube);
						used.add(k);
					}
					continue;
				}

				const circumference = 2 * Math.PI * ringRadius;
				let ringCount = Math.ceil(circumference / Math.max(faceW * horizontalFactor, 0.001));
				ringCount = Math.max(minRingCount, ringCount);

				for (let i = 0; i < ringCount; i++) {
					const yaw = (360 / ringCount) * i;
					const k = key(center[0], center[1], center[2], pitch, yaw);
					if (used.has(k)) continue;

					const cube = makeEllipsoidFace(
						base,
						center,
						radiusX,
						radiusY,
						radiusZ,
						pitch,
						yaw,
						faceW,
						faceH,
						thickness
					);

					cube.addTo(parent);
					cube.init();
					created.push(cube);
					used.add(k);
				}
			}
		}

		Undo.finishEdit("Generate Organic Fusion Surface Between Two Cubes");
		Canvas.updateAll();
		Blockbench.showQuickMessage(
			`Fusão gerada: ${created.length} faces.`
		);
	}
*/

	// ===========================
	// 
	// ===========================
/* TESTE 2
	function generateFusionOrganicMesh(options = {}) {

		const DEBUG = true;

		function log(...a){ if (DEBUG) console.log("[FusionOrganicMesh]", ...a); }

		log("==== generateFusionOrganicMesh START ====");
		log("options =", options);

		const sel = Cube.selected.filter(c => c instanceof Cube);
		if (!sel.length) {
			Blockbench.showQuickMessage("Selecione pelo menos 1 cubo.");
			return;
		}

		const parent = sel[0].parent;
		const base = sel[0];

		const created = [];
		let mesh = null;

		// -----------------------------------------------------
		// CONFIG                                               
		// -----------------------------------------------------

		const densityMode = options.density_mode || "medium";

		const densityPresets = {
			low:    { radial: 8,  step: 4 },
			medium: { radial: 10, step: 6 },
			high:   { radial: 12, step: 8 },
			sealed: { radial: 14, step: 10 }
		};

		const preset = densityPresets[densityMode] || densityPresets.medium;

		const radialSegments = preset.radial;
		const segmentSteps = preset.step;

		const fusionStrength = Math.max(options.fusion_strength || 1.12, 0.1);
		const organicRoundness = Math.max(0, Math.min(options.organic_roundness || 0.75, 1.5));
		const cleanupPrevious = options.cleanup_previous === true;

		log("resolved config", {
			radialSegments,
			segmentSteps,
			fusionStrength,
			organicRoundness
		});

		// -----------------------------------------------------
		// MATH                                                 
		// -----------------------------------------------------

		function lerp(a, b, t){ return a + (b - a) * t; }

		function smoothstep(t){ return t * t * (3 - 2 * t); }

		function sub(a, b){
			return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
		}

		function add(a, b){
			return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
		}

		function scale(v, s){
			return [v[0] * s, v[1] * s, v[2] * s];
		}

		function dot(a, b){
			return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
		}

		function cross(a, b){
			return [
				a[1]*b[2] - a[2]*b[1],
				a[2]*b[0] - a[0]*b[2],
				a[0]*b[1] - a[1]*b[0]
			];
		}

		function length(v){
			return Math.sqrt(dot(v, v));
		}

		function normalize(v){
			const len = length(v) || 1;
			return [v[0] / len, v[1] / len, v[2] / len];
		}

		function rotateAroundAxis(v, axis, angle){
			// Rodrigues
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			const k = normalize(axis);

			const term1 = scale(v, c);
			const term2 = scale(cross(k, v), s);
			const term3 = scale(k, dot(k, v) * (1 - c));

			return add(add(term1, term2), term3);
		}

		// -----------------------------------------------------
		// CUBE INFO                                            
		// -----------------------------------------------------

		function getCubeCenter(c){
			return [
				(c.from[0] + c.to[0]) / 2,
				(c.from[1] + c.to[1]) / 2,
				(c.from[2] + c.to[2]) / 2
			];
		}

		function getCubeSize(c){
			return [
				Math.abs(c.to[0] - c.from[0]),
				Math.abs(c.to[1] - c.from[1]),
				Math.abs(c.to[2] - c.from[2])
			];
		}

		function getCubeRadius(c){
			const s = getCubeSize(c);
			return {
				x: Math.max(s[0] / 2, 0.001),
				y: Math.max(s[1] / 2, 0.001),
				z: Math.max(s[2] / 2, 0.001)
			};
		}

		function getGuide(c){
			return {
				center: getCubeCenter(c),
				radius: getCubeRadius(c),
				size: getCubeSize(c)
			};
		}

		// -----------------------------------------------------
		// SORT GUIDES                                          
		// -----------------------------------------------------

		function getBoundsCenterSpread(guides) {
			const xs = guides.map(g => g.center[0]);
			const ys = guides.map(g => g.center[1]);
			const zs = guides.map(g => g.center[2]);

			return {
				x: Math.max(...xs) - Math.min(...xs),
				y: Math.max(...ys) - Math.min(...ys),
				z: Math.max(...zs) - Math.min(...zs)
			};
		}

		function sortGuidesByMainAxis(guides) {
			const spread = getBoundsCenterSpread(guides);

			if (spread.x >= spread.y && spread.x >= spread.z) {
				return guides.sort((a, b) => a.center[0] - b.center[0]);
			}
			if (spread.y >= spread.x && spread.y >= spread.z) {
				return guides.sort((a, b) => a.center[1] - b.center[1]);
			}
			return guides.sort((a, b) => a.center[2] - b.center[2]);
		}

		// -----------------------------------------------------
		// BASIS                                                
		// -----------------------------------------------------

		function makeInitialBasis(forward){
			const f = normalize(forward);
			let ref = [0, 1, 0];

			if (Math.abs(dot(f, ref)) > 0.92) {
				ref = [1, 0, 0];
			}

			let right = cross(ref, f);

			if (length(right) < 0.0001) {
				ref = [0, 0, 1];
				right = cross(ref, f);
			}

			right = normalize(right);
			const up = normalize(cross(f, right));

			return { forward: f, right, up };
		}

		function transportBasis(prevBasis, newForward){
			const f0 = normalize(prevBasis.forward);
			const f1 = normalize(newForward);

			let axis = cross(f0, f1);
			const axisLen = length(axis);
			const d = Math.max(-1, Math.min(1, dot(f0, f1)));

			// quase mesma direção
			if (axisLen < 1e-5) {
				// direção oposta
				if (d < -0.9999) {
					return makeInitialBasis(f1);
				}

				return {
					forward: f1,
					right: prevBasis.right.slice(),
					up: prevBasis.up.slice()
				};
			}

			axis = normalize(axis);
			const angle = Math.acos(d);

			const right = normalize(rotateAroundAxis(prevBasis.right, axis, angle));
			const up = normalize(cross(f1, right));

			return {
				forward: f1,
				right,
				up
			};
		}

		// -----------------------------------------------------
		// FIND OLD MESHES                                      
		// -----------------------------------------------------

		function findPreviousMeshes(){
			return Outliner.elements.filter(el =>
				el instanceof Mesh &&
				el.name &&
				el.name.indexOf("Fusion Organic Mesh") === 0 &&
				!el.removed
			);
		}

		const oldMeshes = cleanupPrevious ? findPreviousMeshes() : [];

		if (cleanupPrevious && oldMeshes.length) {
			log("Removendo meshes anteriores:", oldMeshes.length);
			oldMeshes.forEach(m => m.remove());
		} else {
			log("Nenhuma mesh anterior será removida.");
		}

		// -----------------------------------------------------
		// UNDO                                                 
		// -----------------------------------------------------

		Undo.initEdit({
			elements: created,
			outliner: true,
			selection: true
		});

		// -----------------------------------------------------
		// MESH                                                 
		// -----------------------------------------------------

		mesh = new Mesh({
			name: "Fusion Organic Mesh",
			color: base.color,
			origin: [0, 0, 0]
		});

		created.push(mesh);

		mesh.vertices = {};
		mesh.faces = {};

		let vIndex = 0;
		let fIndex = 0;

		function addVertex(p){
			const k = "v_" + (vIndex++);
			mesh.vertices[k] = p.slice();
			return k;
		}

		function addFace(vs){
			const key = "f_" + (fIndex++);
			mesh.faces[key] = new MeshFace(mesh, {
				vertices: vs.slice(),
				texture: false
			});
		}

		function connectRings(a, b){
			if (!a || !b) return;
			if (a.length !== b.length) return;

			for (let i = 0; i < a.length; i++) {
				const a0 = a[i];
				const a1 = a[(i + 1) % a.length];
				const b1 = b[(i + 1) % b.length];
				const b0 = b[i];

				addFace([a0, a1, b1, b0]);
			}
		}

		function capRing(center, ring, invert){
			for (let i = 0; i < ring.length; i++) {
				const a = ring[i];
				const b = ring[(i + 1) % ring.length];

				if (invert) addFace([center, b, a]);
				else addFace([center, a, b]);
			}
		}

		function buildRing(center, basis, rx, ry, rz){
			const ring = [];

			const avg = Math.max((rx + rz) * 0.5, 0.001);
			const sectionScale = lerp(1.0, ry / avg, 0.35 * organicRoundness);

			for (let i = 0; i < radialSegments; i++) {
				const yaw = (i / radialSegments) * Math.PI * 2;

				const x = Math.cos(yaw);
				const z = Math.sin(yaw);

				const offset = add(
					scale(basis.right, x * rx * sectionScale),
					scale(basis.up,    z * rz * sectionScale)
				);

				const pos = add(center, offset);
				ring.push(addVertex(pos));
			}

			return ring;
		}

		// -----------------------------------------------------
		// SINGLE CUBE                                          
		// -----------------------------------------------------

		function buildSingle(c){
			const center = c.center;
			const r = c.radius;
			const lat = 6;
			const rings = [];

			const bottom = addVertex([center[0], center[1] - r.y, center[2]]);

			for (let j = 1; j < lat; j++) {
				const t = j / lat;
				const phi = Math.PI * t;

				const y = Math.cos(phi);
				const rad = Math.sin(phi);

				const ring = [];

				for (let i = 0; i < radialSegments; i++) {
					const yaw = (i / radialSegments) * Math.PI * 2;

					const x = center[0] + Math.cos(yaw) * rad * r.x;
					const z = center[2] + Math.sin(yaw) * rad * r.z;
					const yy = center[1] - y * r.y;

					ring.push(addVertex([x, yy, z]));
				}

				rings.push(ring);
			}

			const top = addVertex([center[0], center[1] + r.y, center[2]]);

			capRing(bottom, rings[0], true);

			for (let i = 0; i < rings.length - 1; i++) {
				connectRings(rings[i], rings[i + 1]);
			}

			capRing(top, rings[rings.length - 1], false);
		}

		// -----------------------------------------------------
		// MULTI CUBES - CONTÍNUO                               
		// -----------------------------------------------------

		function buildContinuousFusion(guides){
			if (guides.length < 2) {
				buildSingle(guides[0]);
				return;
			}

			const allRings = [];

			let basis = null;

			for (let gi = 0; gi < guides.length - 1; gi++) {
				const a = guides[gi];
				const b = guides[gi + 1];

				const segVec = sub(b.center, a.center);
				const segLen = length(segVec);

				if (segLen < 1e-5) continue;

				const forward = normalize(segVec);

				if (!basis) {
					basis = makeInitialBasis(forward);
				} else {
					basis = transportBasis(basis, forward);
				}

				const steps = Math.max(2, segmentSteps);

				for (let s = 0; s <= steps; s++) {
					// evita duplicar o primeiro ring nos segmentos seguintes
					if (gi > 0 && s === 0) continue;

					const raw = s / steps;
					const t = smoothstep(raw);

					const center = [
						lerp(a.center[0], b.center[0], t),
						lerp(a.center[1], b.center[1], t),
						lerp(a.center[2], b.center[2], t)
					];

					let tangent;
					if (raw < 0.999) {
						const raw2 = Math.min(1, raw + 1 / steps);
						const t2 = smoothstep(raw2);

						const nextCenter = [
							lerp(a.center[0], b.center[0], t2),
							lerp(a.center[1], b.center[1], t2),
							lerp(a.center[2], b.center[2], t2)
						];

						tangent = normalize(sub(nextCenter, center));
					} else {
						tangent = forward;
					}

					basis = transportBasis(basis, tangent);

					let rx = lerp(a.radius.x, b.radius.x, t);
					let ry = lerp(a.radius.y, b.radius.y, t);
					let rz = lerp(a.radius.z, b.radius.z, t);

					const bulge = Math.pow(Math.sin(raw * Math.PI), 0.85);
					const bulgeScale = 1 + (fusionStrength - 1) * bulge;

					rx *= bulgeScale;
					ry *= lerp(1, bulgeScale, 0.6);
					rz *= bulgeScale;

					const ring = buildRing(center, basis, rx, ry, rz);
					allRings.push(ring);
				}
			}

			if (allRings.length < 2) return;

			for (let i = 0; i < allRings.length - 1; i++) {
				connectRings(allRings[i], allRings[i + 1]);
			}

			const firstGuide = guides[0];
			const lastGuide = guides[guides.length - 1];

			const startForward = normalize(sub(guides[1].center, guides[0].center));
			const endForward = normalize(sub(
				guides[guides.length - 1].center,
				guides[guides.length - 2].center
			));

			const startCenter = add(firstGuide.center, scale(startForward, -0.001));
			const endCenter = add(lastGuide.center, scale(endForward, 0.001));

			const startCap = addVertex(startCenter);
			const endCap = addVertex(endCenter);

			capRing(startCap, allRings[0], true);
			capRing(endCap, allRings[allRings.length - 1], false);
		}

		// -----------------------------------------------------
		// BUILD                                                
		// -----------------------------------------------------

		try {
			mesh.addTo(parent);
			mesh.init();

			const guides = sortGuidesByMainAxis(sel.map(getGuide));

			log("guides sorted =", guides.map(g => ({
				center: g.center,
				radius: g.radius
			})));

			if (guides.length === 1) {
				log("single cube ellipsoid");
				buildSingle(guides[0]);
			} else {
				log("multi cube continuous fusion");
				buildContinuousFusion(guides);
			}

			mesh.preview_controller.updateGeometry(mesh);
			mesh.select();
			Canvas.updateAll();

			Undo.finishEdit("Generate Fusion Organic Mesh");

			log("==== generateFusionOrganicMesh END ====");

		} catch (err) {
			console.error(err);

			if (mesh && mesh.parent) {
				mesh.remove();
			}

			Undo.cancelEdit();
		}
	}
*/




	// ===========================
	// 
	// ===========================
async function autoUVAtlasSelectedMeshes(options = {}) {
	const DEBUG = true;
	function log(...a) { if (DEBUG) console.log("[AutoUVAtlas]", ...a); }

	const atlasWidth = Math.max(1, options.atlas_width || 128);
	const atlasHeight = Math.max(1, options.atlas_height || 128);
	const padding = Math.max(0, options.padding ?? 2);
	const margin = Math.max(0, options.margin ?? 1);
	const allowRotate = options.allow_rotate === true;
	const createTexture = options.create_texture !== false;
	const textureName = options.texture_name || `auto_uv_${atlasWidth}x${atlasHeight}`;

	const setProjectSize = options.set_project_uv_size !== false;
	const projectUVWidth = Math.max(1, options.project_uv_width || atlasWidth);
	const projectUVHeight = Math.max(1, options.project_uv_height || atlasHeight);

	const selectedMeshes = Outliner.selected.filter(el => el instanceof Mesh && !el.removed);

	if (!selectedMeshes.length) {
		Blockbench.showQuickMessage("Selecione pelo menos 1 mesh.");
		return;
	}

	Undo.initEdit({
		elements: selectedMeshes,
		outliner: true,
		selection: true
	});

	/* ----------------------------------------------------- */
	/* MATH                                                  */
	/* ----------------------------------------------------- */

	function cloneVec(v) {
		return [v[0], v[1], v[2]];
	}

	function cloneUV(v) {
		return [v[0], v[1]];
	}

	function add(a, b) {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	}

	function sub(a, b) {
		return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	}

	function scale(v, s) {
		return [v[0] * s, v[1] * s, v[2] * s];
	}

	function dot(a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}

	function cross(a, b) {
		return [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0]
		];
	}

	function length(v) {
		return Math.sqrt(dot(v, v));
	}

	function normalize(v) {
		const len = length(v) || 1;
		return [v[0] / len, v[1] / len, v[2] / len];
	}

	function clamp(v, min, max) {
		return Math.max(min, Math.min(max, v));
	}

	/* ----------------------------------------------------- */
	/* GEOMETRY                                              */
	/* ----------------------------------------------------- */

	function getFaceVertexKeys(face) {
		if (!face || !face.vertices) return [];
		return face.vertices.slice();
	}

	function getFacePositions(face, verticesMap) {
		return getFaceVertexKeys(face)
			.map(k => verticesMap[k])
			.filter(Boolean)
			.map(cloneVec);
	}

	function getFaceNormal(face, verticesMap) {
		const verts = getFacePositions(face, verticesMap);
		if (verts.length < 3) return [0, 1, 0];

		for (let i = 1; i < verts.length - 1; i++) {
			const a = verts[0];
			const b = verts[i];
			const c = verts[i + 1];

			const ab = sub(b, a);
			const ac = sub(c, a);
			const n = cross(ab, ac);
			if (length(n) > 1e-8) return normalize(n);
		}

		return [0, 1, 0];
	}

	function getMeshBounds(mesh) {
		const keys = Object.keys(mesh.vertices || {});
		if (!keys.length) {
			return {
				min: [0, 0, 0],
				max: [0, 0, 0],
				size: [0, 0, 0]
			};
		}

		const first = mesh.vertices[keys[0]];
		const min = cloneVec(first);
		const max = cloneVec(first);

		for (const k of keys) {
			const p = mesh.vertices[k];
			min[0] = Math.min(min[0], p[0]);
			min[1] = Math.min(min[1], p[1]);
			min[2] = Math.min(min[2], p[2]);
			max[0] = Math.max(max[0], p[0]);
			max[1] = Math.max(max[1], p[1]);
			max[2] = Math.max(max[2], p[2]);
		}

		return {
			min,
			max,
			size: [
				max[0] - min[0],
				max[1] - min[1],
				max[2] - min[2]
			]
		};
	}

	/* ----------------------------------------------------- */
	/* PROJECT / TEXTURE UV SIZE                             */
	/* ----------------------------------------------------- */

	function setProjectUVSize(width, height) {
		if (typeof Project !== "undefined") {
			Project.texture_width = width;
			Project.texture_height = height;
		}
	}

	function setTextureUVSize(texture, width, height) {
		if (!texture) return;

		if ("width" in texture) texture.width = width;
		if ("height" in texture) texture.height = height;

		if ("uv_width" in texture) texture.uv_width = width;
		if ("uv_height" in texture) texture.uv_height = height;

		if ("display_width" in texture) texture.display_width = width;
		if ("display_height" in texture) texture.display_height = height;

		if ("render_width" in texture) texture.render_width = width;
		if ("render_height" in texture) texture.render_height = height;

		if (typeof texture.load === "function") {
			texture.load();
		}
		if (typeof texture.updateMaterial === "function") {
			texture.updateMaterial();
		}
	}

	/* ----------------------------------------------------- */
	/* UV PROJECTION                                         */
	/* ----------------------------------------------------- */

	function dominantAxis(normal) {
		const ax = Math.abs(normal[0]);
		const ay = Math.abs(normal[1]);
		const az = Math.abs(normal[2]);

		if (ax >= ay && ax >= az) return "x";
		if (ay >= ax && ay >= az) return "y";
		return "z";
	}

	function projectPointByAxis(p, axis, bounds) {
		if (axis === "x") {
			return [p[2] - bounds.min[2], bounds.max[1] - p[1]];
		}
		if (axis === "y") {
			return [p[0] - bounds.min[0], bounds.max[2] - p[2]];
		}
		return [p[0] - bounds.min[0], bounds.max[1] - p[1]];
	}

	function unwrapMeshToLocalUV(mesh) {
		const faces = mesh.faces || {};
		const vertices = mesh.vertices || {};
		const bounds = getMeshBounds(mesh);

		const localFaceUVs = {};
		let minU = Infinity, minV = Infinity;
		let maxU = -Infinity, maxV = -Infinity;

		for (const faceKey in faces) {
			const face = faces[faceKey];
			const normal = getFaceNormal(face, vertices);
			const axis = dominantAxis(normal);

			localFaceUVs[faceKey] = {};

			for (const vk of getFaceVertexKeys(face)) {
				const p = vertices[vk];
				if (!p) continue;

				const uv = projectPointByAxis(p, axis, bounds);
				localFaceUVs[faceKey][vk] = uv;

				minU = Math.min(minU, uv[0]);
				minV = Math.min(minV, uv[1]);
				maxU = Math.max(maxU, uv[0]);
				maxV = Math.max(maxV, uv[1]);
			}
		}

		if (!isFinite(minU)) {
			minU = minV = 0;
			maxU = maxV = 1;
		}

		const width = Math.max(0.0001, maxU - minU);
		const height = Math.max(0.0001, maxV - minV);

		return {
			mesh,
			localFaceUVs,
			bounds2D: {
				minU,
				minV,
				maxU,
				maxV,
				width,
				height
			}
		};
	}

	/* ----------------------------------------------------- */
	/* PACKING                                               */
	/* ----------------------------------------------------- */

	function packRectsShelf(items, atlasW, atlasH, pad, allowRotateFlag) {
		const packed = [];

		const sorted = items.slice().sort((a, b) => {
			const ah = Math.max(a.bounds2D.width, a.bounds2D.height);
			const bh = Math.max(b.bounds2D.width, b.bounds2D.height);
			return bh - ah;
		});

		let x = margin;
		let y = margin;
		let rowH = 0;
		let usedW = 0;
		let usedH = 0;

		for (const item of sorted) {
			let w = item.bounds2D.width + pad * 2;
			let h = item.bounds2D.height + pad * 2;
			let rotated = false;

			if (allowRotateFlag && w > h && x + w > atlasW && x + h <= atlasW) {
				[w, h] = [h, w];
				rotated = true;
			}

			if (x + w > atlasW) {
				x = margin;
				y += rowH;
				rowH = 0;
			}

			if (y + h > atlasH) {
				return {
					success: false,
					packed: [],
					usedWidth: usedW,
					usedHeight: usedH
				};
			}

			packed.push({
				item,
				x,
				y,
				w,
				h,
				rotated
			});

			x += w;
			rowH = Math.max(rowH, h);
			usedW = Math.max(usedW, x);
			usedH = Math.max(usedH, y + h);
		}

		return {
			success: true,
			packed,
			usedWidth: usedW,
			usedHeight: usedH
		};
	}

	function scaleLayoutsToFit(layouts, atlasW, atlasH, pad, allowRotateFlag) {
		let scaleFactor = 1.0;

		for (let attempt = 0; attempt < 40; attempt++) {
			const scaled = layouts.map(l => ({
				...l,
				bounds2D: {
					...l.bounds2D,
					width: l.bounds2D.width * scaleFactor,
					height: l.bounds2D.height * scaleFactor
				},
				__scaleFactor: scaleFactor
			}));

			const result = packRectsShelf(scaled, atlasW, atlasH, pad, allowRotateFlag);
			if (result.success) return result;

			scaleFactor *= 0.92;
		}

		return null;
	}

	function applyPackedUVs(packedResult) {
		for (const entry of packedResult.packed) {
			const { item, x, y, rotated } = entry;
			const mesh = item.mesh;
			const faces = mesh.faces || {};

			const srcMinU = item.bounds2D.minU;
			const srcMinV = item.bounds2D.minV;
			const srcW = Math.max(0.0001, item.bounds2D.width / item.__scaleFactor);
			const srcH = Math.max(0.0001, item.bounds2D.height / item.__scaleFactor);

			const dstW = Math.max(0.0001, entry.w - padding * 2);
			const dstH = Math.max(0.0001, entry.h - padding * 2);

			for (const faceKey in faces) {
				const face = faces[faceKey];
				const localUVs = item.localFaceUVs[faceKey];
				if (!localUVs) continue;

				face.uv = face.uv || {};

				for (const vk of getFaceVertexKeys(face)) {
					const luv = localUVs[vk];
					if (!luv) continue;

					let ru = (luv[0] - srcMinU) / srcW;
					let rv = (luv[1] - srcMinV) / srcH;

					ru = clamp(ru, 0, 1);
					rv = clamp(rv, 0, 1);

					let u, v;

					if (!rotated) {
						u = x + padding + ru * dstW;
						v = y + padding + rv * dstH;
					} else {
						u = x + padding + rv * dstW;
						v = y + padding + (1 - ru) * dstH;
					}

					face.uv[vk] = [u, v];
				}
			}

			if (mesh.preview_controller && typeof mesh.preview_controller.updateGeometry === "function") {
				mesh.preview_controller.updateGeometry(mesh);
			}
		}
	}

	/* ----------------------------------------------------- */
	/* TEXTURE CREATE / ASSIGN                               */
	/* ----------------------------------------------------- */

	function ensureTexture(atlasW, atlasH, name) {
		let tex = Texture.all.find(t => t.name === name);
		if (tex) {
			setTextureUVSize(tex, atlasW, atlasH);
			return tex;
		}

		if (!createTexture) return null;

		const canvas = document.createElement("canvas");
		canvas.width = atlasW;
		canvas.height = atlasH;

		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, atlasW, atlasH);

		const dataUrl = canvas.toDataURL("image/png");

		tex = new Texture({
			mode: "bitmap",
			name: name,
			saved: false
		}).fromDataURL(dataUrl);

		tex.add(false);
		setTextureUVSize(tex, atlasW, atlasH);

		return tex;
	}

	function getTextureByUUID(uuid) {
		return Texture.all.find(t =>
			t.uuid === uuid ||
			t.id === uuid ||
			t.name === uuid
		) || null;
	}

	function refreshMeshesTextureAndUV(meshes, texture) {
		if (!texture) return;

		for (const mesh of meshes) {
			for (const faceKey in mesh.faces) {
				mesh.faces[faceKey].texture = texture.uuid;
			}

			if (mesh.preview_controller && typeof mesh.preview_controller.updateGeometry === "function") {
				mesh.preview_controller.updateGeometry(mesh);
			}
		}
	}

	/* ----------------------------------------------------- */
	/* SNAPSHOT FOR BAKE                                     */
	/* ----------------------------------------------------- */

	function snapshotMeshForAtlasBake(mesh) {
		const vertices = {};
		for (const vk in mesh.vertices) {
			vertices[vk] = cloneVec(mesh.vertices[vk]);
		}

		const triangles = [];
		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			const face = faces[faceKey];
			const verts = getFaceVertexKeys(face);
			if (verts.length < 3) continue;

			for (let i = 1; i < verts.length - 1; i++) {
				const k0 = verts[0];
				const k1 = verts[i];
				const k2 = verts[i + 1];

				if (!vertices[k0] || !vertices[k1] || !vertices[k2]) continue;
				if (!face.uv || !face.uv[k0] || !face.uv[k1] || !face.uv[k2]) continue;

				triangles.push({
					faceKey,
					texture: face.texture,
					v0: k0,
					v1: k1,
					v2: k2,
					p0: cloneVec(vertices[k0]),
					p1: cloneVec(vertices[k1]),
					p2: cloneVec(vertices[k2]),
					uv0: cloneUV(face.uv[k0]),
					uv1: cloneUV(face.uv[k1]),
					uv2: cloneUV(face.uv[k2])
				});
			}
		}

		return { vertices, triangles };
	}

	/* ----------------------------------------------------- */
	/* IMAGE HELPERS                                         */
	/* ----------------------------------------------------- */

	function loadImageFromTexture(texture) {
		return new Promise((resolve, reject) => {
			if (!texture) {
				reject(new Error("Texture inválida"));
				return;
			}

			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = err => reject(err);

			if (texture.source) {
				img.src = texture.source;
			} else if (texture.img && texture.img.src) {
				img.src = texture.img.src;
			} else if (texture.canvas && typeof texture.canvas.toDataURL === "function") {
				img.src = texture.canvas.toDataURL("image/png");
			} else {
				reject(new Error("Texture sem source"));
			}
		});
	}

	/* ----------------------------------------------------- */
	/* TRIANGLE RASTER                                       */
	/* ----------------------------------------------------- */

	function edgeFunction(a, b, c) {
		return (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
	}

	function barycentric(p, a, b, c) {
		const area = edgeFunction(a, b, c);
		if (Math.abs(area) < 1e-8) return null;

		const w0 = edgeFunction(b, c, p) / area;
		const w1 = edgeFunction(c, a, p) / area;
		const w2 = edgeFunction(a, b, p) / area;

		return [w0, w1, w2];
	}

	function pointInTriangleBary(w0, w1, w2) {
		return w0 >= 0 && w1 >= 0 && w2 >= 0;
	}

	function rasterTriangleToAtlas(dstImageData, srcImageData, srcW, srcH, dstW, dstH, srcTri, dstTri) {
		const minX = Math.max(0, Math.floor(Math.min(dstTri[0][0], dstTri[1][0], dstTri[2][0])));
		const minY = Math.max(0, Math.floor(Math.min(dstTri[0][1], dstTri[1][1], dstTri[2][1])));
		const maxX = Math.min(dstW - 1, Math.ceil(Math.max(dstTri[0][0], dstTri[1][0], dstTri[2][0])));
		const maxY = Math.min(dstH - 1, Math.ceil(Math.max(dstTri[0][1], dstTri[1][1], dstTri[2][1])));

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				const bc = barycentric([x + 0.5, y + 0.5], dstTri[0], dstTri[1], dstTri[2]);
				if (!bc) continue;

				const [w0, w1, w2] = bc;
				if (!pointInTriangleBary(w0, w1, w2)) continue;

				const su = srcTri[0][0] * w0 + srcTri[1][0] * w1 + srcTri[2][0] * w2;
				const sv = srcTri[0][1] * w0 + srcTri[1][1] * w1 + srcTri[2][1] * w2;

				const sx = clamp(Math.round(su), 0, srcW - 1);

				// Se ficar invertido verticalmente em algum modelo:
				// troque por: const sy = clamp(Math.round(srcH - 1 - sv), 0, srcH - 1);
				const sy = clamp(Math.round(sv), 0, srcH - 1);

				const srcIdx = (sy * srcW + sx) * 4;
				const dstIdx = (y * dstW + x) * 4;

				dstImageData.data[dstIdx + 0] = srcImageData.data[srcIdx + 0];
				dstImageData.data[dstIdx + 1] = srcImageData.data[srcIdx + 1];
				dstImageData.data[dstIdx + 2] = srcImageData.data[srcIdx + 2];
				dstImageData.data[dstIdx + 3] = srcImageData.data[srcIdx + 3];
			}
		}
	}

	/* ----------------------------------------------------- */
	/* OPTIONAL EDGE BLEED                                   */
	/* ----------------------------------------------------- */

	function dilateAtlasEdges(canvas, iterations = 1) {
		if (iterations <= 0) return;

		const ctx = canvas.getContext("2d");
		let img = ctx.getImageData(0, 0, canvas.width, canvas.height);

		for (let iter = 0; iter < iterations; iter++) {
			const src = new Uint8ClampedArray(img.data);
			const dst = img.data;
			const w = canvas.width;
			const h = canvas.height;

			function alphaAt(x, y) {
				return src[(y * w + x) * 4 + 3];
			}

			for (let y = 1; y < h - 1; y++) {
				for (let x = 1; x < w - 1; x++) {
					const idx = (y * w + x) * 4;
					if (src[idx + 3] > 0) continue;

					let found = -1;
					const neighbors = [
						[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
						[x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]
					];

					for (const [nx, ny] of neighbors) {
						if (alphaAt(nx, ny) > 0) {
							found = (ny * w + nx) * 4;
							break;
						}
					}

					if (found >= 0) {
						dst[idx + 0] = src[found + 0];
						dst[idx + 1] = src[found + 1];
						dst[idx + 2] = src[found + 2];
						dst[idx + 3] = src[found + 3];
					}
				}
			}
		}

		ctx.putImageData(img, 0, 0);
	}

	/* ----------------------------------------------------- */
	/* BAKE OLD TEXTURES INTO NEW ATLAS                      */
	/* ----------------------------------------------------- */

	async function bakeOriginalTexturesToAtlas(meshSnapshots, atlasTexture, atlasW, atlasH) {
		const atlasCanvas = document.createElement("canvas");
		atlasCanvas.width = atlasW;
		atlasCanvas.height = atlasH;

		const atlasCtx = atlasCanvas.getContext("2d");
		atlasCtx.clearRect(0, 0, atlasW, atlasH);

		const atlasImageData = atlasCtx.getImageData(0, 0, atlasW, atlasH);
		const textureCache = new Map();

		async function getTexturePixels(textureUUID) {
			if (!textureUUID) return null;
			if (textureCache.has(textureUUID)) return textureCache.get(textureUUID);

			const tex = getTextureByUUID(textureUUID);
			if (!tex) return null;

			const img = await loadImageFromTexture(tex);
			const canvas = document.createElement("canvas");
			canvas.width = img.naturalWidth || img.width;
			canvas.height = img.naturalHeight || img.height;

			const ctx = canvas.getContext("2d");
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0);

			const data = ctx.getImageData(0, 0, canvas.width, canvas.height);

			const result = {
				texture: tex,
				image: img,
				width: canvas.width,
				height: canvas.height,
				imageData: data
			};

			textureCache.set(textureUUID, result);
			return result;
		}

		for (const entry of meshSnapshots) {
			const { before, mesh } = entry;

			for (let i = 0; i < before.triangles.length; i++) {
				const triOld = before.triangles[i];
				const face = mesh.faces[triOld.faceKey];
				if (!face || !face.uv) continue;

				const texInfo = await getTexturePixels(triOld.texture);
				if (!texInfo) continue;

				const dst0 = face.uv[triOld.v0];
				const dst1 = face.uv[triOld.v1];
				const dst2 = face.uv[triOld.v2];
				if (!dst0 || !dst1 || !dst2) continue;

				const srcTri = [
					[triOld.uv0[0], triOld.uv0[1]],
					[triOld.uv1[0], triOld.uv1[1]],
					[triOld.uv2[0], triOld.uv2[1]]
				];

				const dstTri = [
					[dst0[0], dst0[1]],
					[dst1[0], dst1[1]],
					[dst2[0], dst2[1]]
				];

				rasterTriangleToAtlas(
					atlasImageData,
					texInfo.imageData,
					texInfo.width,
					texInfo.height,
					atlasW,
					atlasH,
					srcTri,
					dstTri
				);
			}
		}

		atlasCtx.putImageData(atlasImageData, 0, 0);

		dilateAtlasEdges(atlasCanvas, Math.max(0, Math.min(4, padding)));

		const dataUrl = atlasCanvas.toDataURL("image/png");

		if (typeof atlasTexture.fromDataURL === "function") {
			atlasTexture.fromDataURL(dataUrl);
		}
		if (typeof atlasTexture.updateSource === "function") {
			atlasTexture.updateSource(dataUrl);
		}
		if (typeof atlasTexture.load === "function") {
			atlasTexture.load();
		}

		setTextureUVSize(atlasTexture, atlasW, atlasH);
	}

	/* ----------------------------------------------------- */
	/* MAIN                                                  */
	/* ----------------------------------------------------- */

	try {
		log("==== autoUVAtlasSelectedMeshes START ====");
		log("selectedMeshes =", selectedMeshes.map(m => m.name || "Mesh"));

		const bakeSnapshots = selectedMeshes.map(mesh => ({
			mesh,
			before: snapshotMeshForAtlasBake(mesh)
		}));

		const layouts = selectedMeshes.map(mesh => unwrapMeshToLocalUV(mesh));

		log("layouts =", layouts.map(l => ({
			name: l.mesh.name,
			w: l.bounds2D.width,
			h: l.bounds2D.height
		})));

		const packedResult = scaleLayoutsToFit(layouts, atlasWidth, atlasHeight, padding, allowRotate);

		if (!packedResult) {
			throw new Error(`Não foi possível encaixar as meshes em ${atlasWidth}x${atlasHeight}`);
		}

		const texture = ensureTexture(atlasWidth, atlasHeight, textureName);

		if (setProjectSize) {
			setProjectUVSize(projectUVWidth, projectUVHeight);
		}

		setTextureUVSize(texture, atlasWidth, atlasHeight);

		applyPackedUVs(packedResult);
		refreshMeshesTextureAndUV(selectedMeshes, texture);

		if (texture) {
			await bakeOriginalTexturesToAtlas(
				bakeSnapshots,
				texture,
				atlasWidth,
				atlasHeight
			);

			setTextureUVSize(texture, atlasWidth, atlasHeight);
		}

		for (const mesh of selectedMeshes) {
			if (mesh.preview_controller && typeof mesh.preview_controller.updateGeometry === "function") {
				mesh.preview_controller.updateGeometry(mesh);
			}
		}

		Canvas.updateAll();
		Undo.finishEdit("Auto UV Atlas Selected Meshes");

		Blockbench.showQuickMessage(
			`Auto UV Atlas criado: ${atlasWidth}x${atlasHeight} | Meshes: ${selectedMeshes.length}` +
			(setProjectSize ? ` | Projeto UV: ${projectUVWidth}x${projectUVHeight}` : ""),
			4000
		);

		log("==== autoUVAtlasSelectedMeshes END ====");
	} catch (err) {
		console.error(err);
		Undo.cancelEdit();
		Blockbench.showQuickMessage("Erro ao gerar Auto UV Atlas.", 3000);
	}
}

function openAutoUVAtlasDialog() {
	const dialog = new Dialog({
		id: "auto_uv_atlas_dialog",
		title: "Criar Auto UV Atlas",
		form: {
			atlas_width: {
				label: "Largura da textura atlas",
				type: "number",
				value: 128,
				min: 16,
				max: 4096,
				step: 1
			},
			atlas_height: {
				label: "Altura da textura atlas",
				type: "number",
				value: 128,
				min: 16,
				max: 4096,
				step: 1
			},
			padding: {
				label: "Padding entre layouts",
				type: "number",
				value: 2,
				min: 0,
				max: 64,
				step: 1
			},
			margin: {
				label: "Margem externa",
				type: "number",
				value: 1,
				min: 0,
				max: 64,
				step: 1
			},
			allow_rotate: {
				label: "Permitir rotação no packing",
				type: "checkbox",
				value: true
			},
			create_texture: {
				label: "Criar textura automaticamente",
				type: "checkbox",
				value: true
			},
			texture_name: {
				label: "Nome da textura",
				type: "text",
				value: "auto_uv_128x128"
			},
			set_project_uv_size: {
				label: "Definir UV size do projeto",
				type: "checkbox",
				value: true
			},
			project_uv_width: {
				label: "Project UV Width",
				type: "number",
				value: 128,
				min: 16,
				max: 4096,
				step: 1
			},
			project_uv_height: {
				label: "Project UV Height",
				type: "number",
				value: 128,
				min: 16,
				max: 4096,
				step: 1
			}
		},
		buttons: ["OK", "Cancelar"],
		onConfirm(data) {
			dialog.hide();
			autoUVAtlasSelectedMeshes(data);
		}
	});

	dialog.show();
}

	// ===========================
	// 
	// ===========================
function optimizeSelectedMeshes(options = {}) {

	const DEBUG = true;
	function log(...a) { if (DEBUG) console.log("[OptimizeMesh]", ...a); }

	const optimizationMode = options.optimization_mode || "medium";
	const useCustomReduction = options.use_custom_reduction === true;
	const preserveBorders = options.preserve_borders !== false;
	const weldVertices = options.weld_vertices !== false;
	const mergeCoplanar = options.merge_coplanar !== false;
	const cleanupDegenerates = options.cleanup_degenerates !== false;
	const transferOriginalUV = options.transfer_original_uv !== false;
	const maxPasses = Math.max(1, options.max_passes || 8);

	const modePresets = {
		low: {
			epsilon: 0.0001,
			normalEpsilon: 0.0005,
			edgeFactor: 0.04,
			collapsePasses: 1
		},
		medium: {
			epsilon: 0.0001,
			normalEpsilon: 0.00075,
			edgeFactor: 0.08,
			collapsePasses: 2
		},
		high: {
			epsilon: 0.00015,
			normalEpsilon: 0.001,
			edgeFactor: 0.14,
			collapsePasses: 4
		},
		aggressive: {
			epsilon: 0.0002,
			normalEpsilon: 0.0015,
			edgeFactor: 0.22,
			collapsePasses: 6
		}
	};

	const preset = modePresets[optimizationMode] || modePresets.medium;

	const EPSILON = Math.max(options.epsilon || preset.epsilon, 0.000001);
	const NORMAL_EPSILON = Math.max(options.normal_epsilon || preset.normalEpsilon, 0.000001);

	let edgeFactor = preset.edgeFactor;
	if (useCustomReduction) {
		edgeFactor = Math.max(0.005, Math.min(options.reduction_strength || edgeFactor, 1));
	}

	const collapsePasses = Math.max(0, Math.floor(
		useCustomReduction
			? (options.collapse_passes || preset.collapsePasses)
			: preset.collapsePasses
	));

	log("==== optimizeSelectedMeshes START ====");
	log("options =", options);
	log("resolved =", {
		optimizationMode,
		EPSILON,
		NORMAL_EPSILON,
		edgeFactor,
		collapsePasses,
		preserveBorders,
		weldVertices,
		mergeCoplanar,
		cleanupDegenerates,
		transferOriginalUV,
		maxPasses
	});

	const selectedMeshes = Outliner.selected.filter(el => el instanceof Mesh && !el.removed);

	if (!selectedMeshes.length) {
		Blockbench.showQuickMessage("Selecione pelo menos 1 mesh.");
		return;
	}

	Undo.initEdit({
		elements: selectedMeshes,
		outliner: true,
		selection: true
	});

	/* ----------------------------------------------------- */
	/* MATH                                                  */
	/* ----------------------------------------------------- */

	function cloneVec(v) {
		return [v[0], v[1], v[2]];
	}

	function cloneUV(v) {
		return [v[0], v[1]];
	}

	function add(a, b) {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	}

	function sub(a, b) {
		return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	}

	function scale(v, s) {
		return [v[0] * s, v[1] * s, v[2] * s];
	}

	function dot(a, b) {
		return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
	}

	function cross(a, b) {
		return [
			a[1]*b[2] - a[2]*b[1],
			a[2]*b[0] - a[0]*b[2],
			a[0]*b[1] - a[1]*b[0]
		];
	}

	function length(v) {
		return Math.sqrt(dot(v, v));
	}

	function lengthSq(v) {
		return dot(v, v);
	}

	function dist(a, b) {
		return length(sub(a, b));
	}

	function distSq(a, b) {
		return lengthSq(sub(a, b));
	}

	function normalize(v) {
		const len = length(v) || 1;
		return [v[0] / len, v[1] / len, v[2] / len];
	}

	function midpoint(a, b) {
		return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
	}

	function clamp(v, min, max) {
		return Math.max(min, Math.min(max, v));
	}

	function vecAlmostEqual(a, b, eps = EPSILON) {
		return (
			Math.abs(a[0] - b[0]) <= eps &&
			Math.abs(a[1] - b[1]) <= eps &&
			Math.abs(a[2] - b[2]) <= eps
		);
	}

	function signedArea2D(points) {
		let area = 0;
		for (let i = 0; i < points.length; i++) {
			const a = points[i];
			const b = points[(i + 1) % points.length];
			area += a[0] * b[1] - b[0] * a[1];
		}
		return area * 0.5;
	}

	function lerp2(a, b, t) {
		return [
			a[0] + (b[0] - a[0]) * t,
			a[1] + (b[1] - a[1]) * t
		];
	}

	function baryLerp2(uv0, uv1, uv2, w0, w1, w2) {
		return [
			uv0[0] * w0 + uv1[0] * w1 + uv2[0] * w2,
			uv0[1] * w0 + uv1[1] * w1 + uv2[1] * w2
		];
	}

	/* ----------------------------------------------------- */
	/* FACE GEOMETRY                                         */
	/* ----------------------------------------------------- */

	function getFaceVertexKeys(face) {
		if (!face || !face.vertices) return [];
		return face.vertices.slice();
	}

	function getFacePositions(face, verticesMap) {
		return getFaceVertexKeys(face).map(k => cloneVec(verticesMap[k]));
	}

	function getFaceNormal(face, verticesMap) {
		const verts = getFacePositions(face, verticesMap);
		if (verts.length < 3) return [0, 1, 0];

		for (let i = 1; i < verts.length - 1; i++) {
			const a = verts[0];
			const b = verts[i];
			const c = verts[i + 1];

			const ab = sub(b, a);
			const ac = sub(c, a);
			const n = cross(ab, ac);
			const len = length(n);

			if (len > EPSILON) return normalize(n);
		}

		return [0, 1, 0];
	}

	function getFacePlane(face, verticesMap) {
		const verts = getFacePositions(face, verticesMap);
		if (verts.length < 3) return null;

		const normal = getFaceNormal(face, verticesMap);
		const origin = verts[0];
		const d = -dot(normal, origin);

		return { normal, d, origin };
	}

	function isDegenerateFaceVerts(vertexKeys, verticesMap) {
		if (!vertexKeys || vertexKeys.length < 3) return true;

		const pts = vertexKeys.map(k => verticesMap[k]);
		for (let i = 0; i < pts.length; i++) {
			if (!pts[i]) return true;
		}

		let foundArea = false;
		for (let i = 1; i < pts.length - 1; i++) {
			const ab = sub(pts[i], pts[0]);
			const ac = sub(pts[i + 1], pts[0]);
			const n = cross(ab, ac);
			if (length(n) > EPSILON) {
				foundArea = true;
				break;
			}
		}

		return !foundArea;
	}

	function removeSequentialDuplicateKeys(keys, verticesMap) {
		if (!keys.length) return keys.slice();

		const out = [];
		for (let i = 0; i < keys.length; i++) {
			const prev = out.length ? out[out.length - 1] : null;
			if (!prev) {
				out.push(keys[i]);
				continue;
			}
			if (!vecAlmostEqual(verticesMap[prev], verticesMap[keys[i]], EPSILON)) {
				out.push(keys[i]);
			}
		}

		if (out.length >= 2) {
			const first = out[0];
			const last = out[out.length - 1];
			if (vecAlmostEqual(verticesMap[first], verticesMap[last], EPSILON)) {
				out.pop();
			}
		}

		return out;
	}

	function removeCollinearFromFace(vertexKeys, verticesMap) {
		let keys = removeSequentialDuplicateKeys(vertexKeys, verticesMap);
		if (keys.length < 3) return keys;

		let changed = true;

		while (changed && keys.length >= 3) {
			changed = false;
			const next = [];

			for (let i = 0; i < keys.length; i++) {
				const ka = keys[(i - 1 + keys.length) % keys.length];
				const kb = keys[i];
				const kc = keys[(i + 1) % keys.length];

				const a = verticesMap[ka];
				const b = verticesMap[kb];
				const c = verticesMap[kc];

				const ab = sub(b, a);
				const bc = sub(c, b);

				const cr = cross(ab, bc);
				const crLen = length(cr);

				const abLen = length(ab);
				const bcLen = length(bc);

				if (abLen <= EPSILON || bcLen <= EPSILON) {
					changed = true;
					continue;
				}

				if (crLen <= EPSILON * (abLen + bcLen)) {
					changed = true;
					continue;
				}

				next.push(kb);
			}

			keys = next;
		}

		return keys;
	}

	function faceSignature(face) {
		return JSON.stringify({
			texture: face.texture === undefined ? null : face.texture,
			cullface: face.cullface || "",
			tint: face.tint || -1,
			rotation: face.rotation || 0
		});
	}

	function areFacesCoplanar(faceA, faceB, verticesMap) {
		const pa = getFacePlane(faceA, verticesMap);
		const pb = getFacePlane(faceB, verticesMap);
		if (!pa || !pb) return false;

		const nd = dot(pa.normal, pb.normal);
		if (Math.abs(Math.abs(nd) - 1) > NORMAL_EPSILON) return false;

		const testPoint = verticesMap[getFaceVertexKeys(faceB)[0]];
		const distToPlane = Math.abs(dot(pa.normal, testPoint) + pa.d);

		return distToPlane <= EPSILON * 4;
	}

	function getSharedEdge(faceA, faceB) {
		const a = getFaceVertexKeys(faceA);
		const b = getFaceVertexKeys(faceB);

		const bSet = new Set(b);
		const shared = a.filter(k => bSet.has(k));

		if (shared.length !== 2) return null;
		return shared;
	}

	function buildPlaneAxes(normal) {
		let ref = [0, 1, 0];
		if (Math.abs(dot(normal, ref)) > 0.95) ref = [1, 0, 0];

		let axisX = cross(ref, normal);
		if (length(axisX) < EPSILON) {
			ref = [0, 0, 1];
			axisX = cross(ref, normal);
		}
		axisX = normalize(axisX);

		const axisY = normalize(cross(normal, axisX));
		return { axisX, axisY };
	}

	function projectPointTo2D(p, origin, axisX, axisY) {
		const v = sub(p, origin);
		return [dot(v, axisX), dot(v, axisY)];
	}

	function orderVerticesOnPlane(vertexKeys, verticesMap, planeNormal) {
		const unique = [];
		for (const k of vertexKeys) {
			if (!unique.includes(k)) unique.push(k);
		}
		if (unique.length < 3) return unique;

		const points = unique.map(k => verticesMap[k]);

		let center = [0, 0, 0];
		for (const p of points) center = add(center, p);
		center = scale(center, 1 / points.length);

		const { axisX, axisY } = buildPlaneAxes(planeNormal);

		const projected = unique.map(k => {
			const p = verticesMap[k];
			const uv = projectPointTo2D(p, center, axisX, axisY);
			return {
				key: k,
				x: uv[0],
				y: uv[1],
				angle: Math.atan2(uv[1], uv[0])
			};
		});

		projected.sort((a, b) => a.angle - b.angle);

		const ordered = projected.map(p => p.key);
		const pts2D = projected.map(p => [p.x, p.y]);
		const area = signedArea2D(pts2D);

		if (area < 0) ordered.reverse();
		return ordered;
	}

	function isConvexPolygon(vertexKeys, verticesMap, planeNormal) {
		if (vertexKeys.length < 3) return false;
		if (vertexKeys.length === 3) return true;

		const origin = verticesMap[vertexKeys[0]];
		const { axisX, axisY } = buildPlaneAxes(planeNormal);
		const pts = vertexKeys.map(k => projectPointTo2D(verticesMap[k], origin, axisX, axisY));

		let sign = 0;

		for (let i = 0; i < pts.length; i++) {
			const a = pts[i];
			const b = pts[(i + 1) % pts.length];
			const c = pts[(i + 2) % pts.length];

			const ab = [b[0] - a[0], b[1] - a[1]];
			const bc = [c[0] - b[0], c[1] - b[1]];
			const z = ab[0] * bc[1] - ab[1] * bc[0];

			if (Math.abs(z) <= EPSILON) continue;

			const s = z > 0 ? 1 : -1;
			if (sign === 0) sign = s;
			else if (sign !== s) return false;
		}

		return true;
	}

	function tryMergeFaces(faceA, faceB, verticesMap) {
		if (!faceA || !faceB) return null;
		if (faceSignature(faceA) !== faceSignature(faceB)) return null;
		if (!areFacesCoplanar(faceA, faceB, verticesMap)) return null;

		const shared = getSharedEdge(faceA, faceB);
		if (!shared) return null;

		const plane = getFacePlane(faceA, verticesMap);
		if (!plane) return null;

		const allKeys = [
			...getFaceVertexKeys(faceA),
			...getFaceVertexKeys(faceB)
		];

		let merged = orderVerticesOnPlane(allKeys, verticesMap, plane.normal);
		merged = removeCollinearFromFace(merged, verticesMap);

		if (merged.length < 3) return null;
		if (!isConvexPolygon(merged, verticesMap, plane.normal)) return null;
		if (isDegenerateFaceVerts(merged, verticesMap)) return null;

		return merged;
	}

	/* ----------------------------------------------------- */
	/* UV TRANSFER                                           */
	/* ----------------------------------------------------- */

	function getMeshBounds(mesh) {
		const keys = Object.keys(mesh.vertices || {});
		if (!keys.length) {
			return {
				min: [0, 0, 0],
				max: [0, 0, 0],
				size: [0, 0, 0],
				diag: 0
			};
		}

		const first = mesh.vertices[keys[0]];
		const min = cloneVec(first);
		const max = cloneVec(first);

		for (const k of keys) {
			const p = mesh.vertices[k];
			min[0] = Math.min(min[0], p[0]);
			min[1] = Math.min(min[1], p[1]);
			min[2] = Math.min(min[2], p[2]);
			max[0] = Math.max(max[0], p[0]);
			max[1] = Math.max(max[1], p[1]);
			max[2] = Math.max(max[2], p[2]);
		}

		const size = sub(max, min);
		const diag = length(size);

		return { min, max, size, diag };
	}

	function getFaceUV(face, vertexKey) {
		if (!face || !face.uv || !face.uv[vertexKey]) return null;
		return cloneUV(face.uv[vertexKey]);
	}

	function snapshotOriginalMesh(mesh) {
		const vertices = {};
		for (const vk in mesh.vertices) {
			vertices[vk] = cloneVec(mesh.vertices[vk]);
		}

		const bounds = getMeshBounds(mesh);
		const triangles = [];
		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			const face = faces[faceKey];
			const verts = getFaceVertexKeys(face);
			if (verts.length < 3) continue;

			const normal = getFaceNormal(face, vertices);

			for (let i = 1; i < verts.length - 1; i++) {
				const k0 = verts[0];
				const k1 = verts[i];
				const k2 = verts[i + 1];

				const p0 = vertices[k0];
				const p1 = vertices[k1];
				const p2 = vertices[k2];
				if (!p0 || !p1 || !p2) continue;

				const uv0 = getFaceUV(face, k0);
				const uv1 = getFaceUV(face, k1);
				const uv2 = getFaceUV(face, k2);
				if (!uv0 || !uv1 || !uv2) continue;

				triangles.push({
					texture: face.texture === undefined ? null : face.texture,
					faceKey,
					normal: normal.slice(),
					p0: cloneVec(p0),
					p1: cloneVec(p1),
					p2: cloneVec(p2),
					uv0: cloneUV(uv0),
					uv1: cloneUV(uv1),
					uv2: cloneUV(uv2)
				});
			}
		}

		return {
			vertices,
			triangles,
			bounds
		};
	}

	function closestPointAndBarycentricOnTriangle(p, a, b, c) {
		// Real-Time Collision Detection - Christer Ericson
		const ab = sub(b, a);
		const ac = sub(c, a);
		const ap = sub(p, a);

		const d1 = dot(ab, ap);
		const d2 = dot(ac, ap);
		if (d1 <= 0 && d2 <= 0) {
			return { point: cloneVec(a), w0: 1, w1: 0, w2: 0 };
		}

		const bp = sub(p, b);
		const d3 = dot(ab, bp);
		const d4 = dot(ac, bp);
		if (d3 >= 0 && d4 <= d3) {
			return { point: cloneVec(b), w0: 0, w1: 1, w2: 0 };
		}

		const vc = d1 * d4 - d3 * d2;
		if (vc <= 0 && d1 >= 0 && d3 <= 0) {
			const v = d1 / (d1 - d3);
			return {
				point: add(a, scale(ab, v)),
				w0: 1 - v,
				w1: v,
				w2: 0
			};
		}

		const cp = sub(p, c);
		const d5 = dot(ab, cp);
		const d6 = dot(ac, cp);
		if (d6 >= 0 && d5 <= d6) {
			return { point: cloneVec(c), w0: 0, w1: 0, w2: 1 };
		}

		const vb = d5 * d2 - d1 * d6;
		if (vb <= 0 && d2 >= 0 && d6 <= 0) {
			const w = d2 / (d2 - d6);
			return {
				point: add(a, scale(ac, w)),
				w0: 1 - w,
				w1: 0,
				w2: w
			};
		}

		const va = d3 * d6 - d5 * d4;
		if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
			const bc = sub(c, b);
			const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
			return {
				point: add(b, scale(bc, w)),
				w0: 0,
				w1: 1 - w,
				w2: w
			};
		}

		const denom = 1 / (va + vb + vc);
		const v = vb * denom;
		const w = vc * denom;
		const u = 1 - v - w;

		return {
			point: add(add(scale(a, u), scale(b, v)), scale(c, w)),
			w0: u,
			w1: v,
			w2: w
		};
	}

	function sampleOriginalUVAtPoint(point, targetNormal, originalSnapshot, textureHint) {
		const tris = originalSnapshot.triangles || [];
		if (!tris.length) return null;

		const diag = Math.max(originalSnapshot.bounds.diag || 1, 1);
		const normalPenaltyScale = diag * diag * 0.05;

		let best = null;
		let bestScore = Infinity;

		for (const tri of tris) {
			if (textureHint !== undefined && textureHint !== null) {
				const triTex = tri.texture === undefined ? null : tri.texture;
				if (triTex !== textureHint) continue;
			}

			const proj = closestPointAndBarycentricOnTriangle(point, tri.p0, tri.p1, tri.p2);
			const d2 = distSq(point, proj.point);

			const nd = Math.max(-1, Math.min(1, dot(targetNormal, tri.normal)));
			const normalPenalty = (1 - Math.max(0, nd)) * normalPenaltyScale;

			const score = d2 + normalPenalty;

			if (score < bestScore) {
				bestScore = score;
				best = {
					tri,
					w0: proj.w0,
					w1: proj.w1,
					w2: proj.w2
				};
			}
		}

		if (!best) {
			for (const tri of tris) {
				const proj = closestPointAndBarycentricOnTriangle(point, tri.p0, tri.p1, tri.p2);
				const d2 = distSq(point, proj.point);
				if (d2 < bestScore) {
					bestScore = d2;
					best = {
						tri,
						w0: proj.w0,
						w1: proj.w1,
						w2: proj.w2
					};
				}
			}
		}

		if (!best) return null;

		return baryLerp2(
			best.tri.uv0,
			best.tri.uv1,
			best.tri.uv2,
			best.w0,
			best.w1,
			best.w2
		);
	}

	function transferMeshUVFromOriginal(mesh, originalSnapshot) {
		if (!originalSnapshot || !originalSnapshot.triangles || !originalSnapshot.triangles.length) return;

		const faces = mesh.faces || {};
		const verticesMap = mesh.vertices || {};

		for (const faceKey in faces) {
			const face = faces[faceKey];
			const verts = getFaceVertexKeys(face);
			if (verts.length < 3) continue;

			const normal = getFaceNormal(face, verticesMap);
			const textureHint = face.texture === undefined ? null : face.texture;

			face.uv = face.uv || {};

			for (const vk of verts) {
				const p = verticesMap[vk];
				if (!p) continue;

				const uv = sampleOriginalUVAtPoint(p, normal, originalSnapshot, textureHint);
				if (uv) {
					face.uv[vk] = cloneUV(uv);
				}
			}
		}
	}

	/* ----------------------------------------------------- */
	/* EDGE HELPERS                                          */
	/* ----------------------------------------------------- */

	function buildEdgeMap(mesh) {
		const edgeMap = new Map();
		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			const face = faces[faceKey];
			const verts = getFaceVertexKeys(face);
			if (verts.length < 2) continue;

			for (let i = 0; i < verts.length; i++) {
				const a = verts[i];
				const b = verts[(i + 1) % verts.length];
				const key = a < b ? a + "|" + b : b + "|" + a;

				if (!edgeMap.has(key)) {
					edgeMap.set(key, {
						a,
						b,
						faces: []
					});
				}
				edgeMap.get(key).faces.push(faceKey);
			}
		}

		return edgeMap;
	}

	function getVertexFaceMap(mesh) {
		const map = new Map();
		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			const verts = getFaceVertexKeys(faces[faceKey]);
			for (const vk of verts) {
				if (!map.has(vk)) map.set(vk, []);
				map.get(vk).push(faceKey);
			}
		}
		return map;
	}

	function isBorderEdge(edgeInfo) {
		return !edgeInfo || edgeInfo.faces.length <= 1;
	}

	function isBorderVertex(mesh, vertexKey) {
		const edgeMap = buildEdgeMap(mesh);
		for (const [, edge] of edgeMap) {
			if ((edge.a === vertexKey || edge.b === vertexKey) && isBorderEdge(edge)) {
				return true;
			}
		}
		return false;
	}

	function getVertexNeighbors(mesh, vertexKey) {
		const out = new Set();
		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			const verts = getFaceVertexKeys(faces[faceKey]);
			if (!verts.includes(vertexKey)) continue;

			for (const vk of verts) {
				if (vk !== vertexKey) out.add(vk);
			}
		}

		return Array.from(out);
	}

	/* ----------------------------------------------------- */
	/* WELD                                                  */
	/* ----------------------------------------------------- */

	function weldMeshVertices(mesh) {
		const oldVertices = mesh.vertices || {};
		const oldKeys = Object.keys(oldVertices);

		const mapOldToNew = {};
		const newVertices = {};
		const buckets = new Map();

		let newIndex = 0;

		function bucketKey(p) {
			const x = Math.round(p[0] / EPSILON);
			const y = Math.round(p[1] / EPSILON);
			const z = Math.round(p[2] / EPSILON);
			return x + "|" + y + "|" + z;
		}

		for (const oldKey of oldKeys) {
			const p = oldVertices[oldKey];
			const bk = bucketKey(p);

			if (!buckets.has(bk)) buckets.set(bk, []);

			let found = null;
			for (const candidate of buckets.get(bk)) {
				if (vecAlmostEqual(candidate.pos, p, EPSILON)) {
					found = candidate.key;
					break;
				}
			}

			if (!found) {
				const nk = "v_" + (newIndex++);
				newVertices[nk] = cloneVec(p);
				buckets.get(bk).push({ key: nk, pos: cloneVec(p) });
				mapOldToNew[oldKey] = nk;
			} else {
				mapOldToNew[oldKey] = found;
			}
		}

		const oldFaces = mesh.faces || {};

		mesh.vertices = newVertices;

		for (const faceKey in oldFaces) {
			oldFaces[faceKey].vertices = getFaceVertexKeys(oldFaces[faceKey]).map(k => mapOldToNew[k]);
		}

		return {
			mergedVertices: oldKeys.length - Object.keys(newVertices).length
		};
	}

	/* ----------------------------------------------------- */
	/* CLEANUP                                               */
	/* ----------------------------------------------------- */

	function cleanupMeshFaces(mesh) {
		const faces = mesh.faces || {};
		const verticesMap = mesh.vertices || {};

		let removed = 0;
		let cleaned = 0;

		for (const faceKey in faces) {
			const face = faces[faceKey];
			let verts = getFaceVertexKeys(face);

			verts = removeSequentialDuplicateKeys(verts, verticesMap);
			verts = removeCollinearFromFace(verts, verticesMap);

			if (verts.length < 3 || isDegenerateFaceVerts(verts, verticesMap)) {
				delete faces[faceKey];
				removed++;
				continue;
			}

			if (verts.length !== face.vertices.length) {
				face.vertices = verts.slice();
				cleaned++;
			}
		}

		return { removed, cleaned };
	}

	function removeUnusedVertices(mesh) {
		const used = new Set();
		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			for (const vk of getFaceVertexKeys(faces[faceKey])) {
				used.add(vk);
			}
		}

		let removed = 0;
		for (const vk in mesh.vertices) {
			if (!used.has(vk)) {
				delete mesh.vertices[vk];
				removed++;
			}
		}
		return removed;
	}

	/* ----------------------------------------------------- */
	/* MERGE COPLANAR                                        */
	/* ----------------------------------------------------- */

	function mergeCoplanarFacesInMesh(mesh) {
		let totalMerged = 0;

		for (let pass = 0; pass < maxPasses; pass++) {
			const faces = mesh.faces || {};
			const verticesMap = mesh.vertices || {};
			const faceKeys = Object.keys(faces);

			let didMergeThisPass = false;

			outer:
			for (let i = 0; i < faceKeys.length; i++) {
				const faKey = faceKeys[i];
				const faceA = faces[faKey];
				if (!faceA) continue;

				for (let j = i + 1; j < faceKeys.length; j++) {
					const fbKey = faceKeys[j];
					const faceB = faces[fbKey];
					if (!faceB) continue;

					const mergedVerts = tryMergeFaces(faceA, faceB, verticesMap);
					if (!mergedVerts) continue;

					faceA.vertices = mergedVerts.slice();
					delete faces[fbKey];

					didMergeThisPass = true;
					totalMerged++;
					break outer;
				}
			}

			if (!didMergeThisPass) break;
		}

		return totalMerged;
	}

	/* ----------------------------------------------------- */
	/* EDGE COLLAPSE                                         */
	/* ----------------------------------------------------- */

	function collapseEdge(mesh, keepKey, removeKey, newPos) {
		if (!mesh.vertices[keepKey] || !mesh.vertices[removeKey]) return false;

		mesh.vertices[keepKey] = cloneVec(newPos);

		const faces = mesh.faces || {};

		for (const faceKey in faces) {
			const face = faces[faceKey];
			const verts = getFaceVertexKeys(face).map(vk => vk === removeKey ? keepKey : vk);
			face.vertices = verts;
		}

		delete mesh.vertices[removeKey];
		return true;
	}

	function simplifyByShortEdges(mesh, factor, passes, preserveBordersFlag) {
		let totalCollapsed = 0;

		if (passes <= 0) return totalCollapsed;

		for (let pass = 0; pass < passes; pass++) {
			const bounds = getMeshBounds(mesh);
			const diag = Math.max(bounds.diag, EPSILON);
			const threshold = diag * factor;

			const edgeMap = buildEdgeMap(mesh);
			const candidates = [];

			for (const [, edge] of edgeMap) {
				const pa = mesh.vertices[edge.a];
				const pb = mesh.vertices[edge.b];
				if (!pa || !pb) continue;

				const len = dist(pa, pb);
				if (len > threshold) continue;

				if (preserveBordersFlag && isBorderEdge(edge)) continue;

				candidates.push({
					a: edge.a,
					b: edge.b,
					len
				});
			}

			candidates.sort((a, b) => a.len - b.len);

			let collapsedThisPass = 0;
			const locked = new Set();

			for (const edge of candidates) {
				if (!mesh.vertices[edge.a] || !mesh.vertices[edge.b]) continue;
				if (locked.has(edge.a) || locked.has(edge.b)) continue;

				if (preserveBordersFlag) {
					const aBorder = isBorderVertex(mesh, edge.a);
					const bBorder = isBorderVertex(mesh, edge.b);

					if (aBorder || bBorder) continue;
				}

				const pa = mesh.vertices[edge.a];
				const pb = mesh.vertices[edge.b];
				const newPos = midpoint(pa, pb);

				const ok = collapseEdge(mesh, edge.a, edge.b, newPos);
				if (!ok) continue;

				cleanupMeshFaces(mesh);
				removeUnusedVertices(mesh);

				locked.add(edge.a);
				locked.add(edge.b);

				collapsedThisPass++;
				totalCollapsed++;
			}

			if (!collapsedThisPass) break;
		}

		return totalCollapsed;
	}

	/* ----------------------------------------------------- */
	/* MAIN                                                  */
	/* ----------------------------------------------------- */

	function optimizeMesh(mesh) {
		if (!mesh || !mesh.vertices || !mesh.faces) {
			return {
				vertexBefore: 0,
				vertexAfter: 0,
				faceBefore: 0,
				faceAfter: 0,
				mergedVertices: 0,
				removedFaces: 0,
				cleanedFaces: 0,
				mergedFaces: 0,
				collapsedEdges: 0
			};
		}

		const originalSnapshot = transferOriginalUV ? snapshotOriginalMesh(mesh) : null;

		const vertexBefore = Object.keys(mesh.vertices).length;
		const faceBefore = Object.keys(mesh.faces).length;

		let mergedVertices = 0;
		let removedFaces = 0;
		let cleanedFaces = 0;
		let mergedFaces = 0;
		let collapsedEdges = 0;

		if (weldVertices) {
			const weldStats = weldMeshVertices(mesh);
			mergedVertices += weldStats.mergedVertices;
		}

		if (cleanupDegenerates) {
			const cleanStats = cleanupMeshFaces(mesh);
			removedFaces += cleanStats.removed;
			cleanedFaces += cleanStats.cleaned;
		}

		if (mergeCoplanar) {
			mergedFaces += mergeCoplanarFacesInMesh(mesh);
		}

		if (collapsePasses > 0) {
			collapsedEdges += simplifyByShortEdges(mesh, edgeFactor, collapsePasses, preserveBorders);
		}

		if (cleanupDegenerates) {
			const cleanStats2 = cleanupMeshFaces(mesh);
			removedFaces += cleanStats2.removed;
			cleanedFaces += cleanStats2.cleaned;
		}

		removeUnusedVertices(mesh);

		if (transferOriginalUV && originalSnapshot) {
			transferMeshUVFromOriginal(mesh, originalSnapshot);
		}

		const vertexAfter = Object.keys(mesh.vertices).length;
		const faceAfter = Object.keys(mesh.faces).length;

		mesh.preview_controller.updateGeometry(mesh);

		return {
			vertexBefore,
			vertexAfter,
			faceBefore,
			faceAfter,
			mergedVertices,
			removedFaces,
			cleanedFaces,
			mergedFaces,
			collapsedEdges
		};
	}

	/* ----------------------------------------------------- */
	/* RUN                                                   */
	/* ----------------------------------------------------- */

	try {
		const reports = [];

		for (const mesh of selectedMeshes) {
			const stats = optimizeMesh(mesh);
			reports.push({
				name: mesh.name || "Mesh",
				...stats
			});
		}

		Canvas.updateAll();
		Undo.finishEdit("Optimize Selected Meshes");

		log("Reports:", reports);

		let totalFaceBefore = 0;
		let totalFaceAfter = 0;
		let totalVertBefore = 0;
		let totalVertAfter = 0;

		for (const r of reports) {
			totalFaceBefore += r.faceBefore;
			totalFaceAfter += r.faceAfter;
			totalVertBefore += r.vertexBefore;
			totalVertAfter += r.vertexAfter;
		}

		Blockbench.showQuickMessage(
			"Otimizadas: " + reports.length +
			" | Faces: " + totalFaceBefore + " → " + totalFaceAfter +
			" | Vértices: " + totalVertBefore + " → " + totalVertAfter +
			(transferOriginalUV ? " | UV transferido da original" : ""),
			3000
		);

		log("==== optimizeSelectedMeshes END ====");

	} catch (err) {
		console.error(err);
		Undo.cancelEdit();
	}
}

function openOptimizeMeshDialog() {
	const dialog = new Dialog({
		id: "a_generate_optimize_mesh_dialogue",
		title: "Otimizar Mesh Selecionada",
		form: {
			optimization_mode: {
				label: "Nível de otimização",
				type: "select",
				options: {
					low: "Baixa",
					medium: "Média",
					high: "Alta",
					aggressive: "Agressiva"
				},
				value: "medium"
			},
			transfer_original_uv: {
				label: "Transferir UV da mesh original",
				type: "checkbox",
				value: true
			},
			use_custom_reduction: {
				label: "Usar redução manual",
				type: "checkbox",
				value: false
			},
			reduction_strength: {
				label: "Força da redução",
				type: "number",
				value: 0.08,
				min: 0.005,
				max: 1,
				step: 0.005
			},
			collapse_passes: {
				label: "Passes de colapso",
				type: "number",
				value: 2,
				min: 0,
				max: 20,
				step: 1
			},
			preserve_borders: {
				label: "Preservar bordas/silhueta",
				type: "checkbox",
				value: true
			},
			weld_vertices: {
				label: "Soldar vértices próximos",
				type: "checkbox",
				value: true
			},
			merge_coplanar: {
				label: "Juntar faces coplanares",
				type: "checkbox",
				value: true
			},
			cleanup_degenerates: {
				label: "Limpar faces problemáticas",
				type: "checkbox",
				value: true
			},
			max_passes: {
				label: "Passes para juntar faces",
				type: "number",
				value: 8,
				min: 1,
				max: 30,
				step: 1
			},
			epsilon: {
				label: "Precisão vértices (epsilon)",
				type: "number",
				value: 0.0001,
				min: 0.000001,
				max: 0.01,
				step: 0.0001
			},
			normal_epsilon: {
				label: "Precisão normais",
				type: "number",
				value: 0.00075,
				min: 0.000001,
				max: 0.01,
				step: 0.0001
			}
		},
		buttons: ["OK", "Cancelar"],
		onConfirm(data) {
			dialog.hide();
			optimizeSelectedMeshes(data);
		}
	});

	dialog.show();
}

	// ===========================
	// Organic Capsule Surface From Cubes
	// Ring-based, with smooth surface quality option
	// ===========================
function openOrganicCapsuleSurfaceDialog() {
	const dialog = new Dialog({
		id: "a_preview_organic_capsule_surface_dialogue",
		title: "Organic Capsule Surface From Skeleton",
		form: {
			density_mode: {
				label: "Densidade",
				type: "select",
				options: {
					low: "Baixa",
					medium: "Média",
					high: "Alta",
					sealed: "Sem buracos"
				},
				value: "medium"
			},
			surface_quality: {
				label: "Qualidade da superfície",
				type: "select",
				options: {
					normal: "Normal",
					smooth: "Suave",
					ultra: "Ultra Suave"
				},
				value: "smooth"
			},
			use_custom_density: {
				label: "Usar multiplicador manual",
				type: "checkbox",
				value: false
			},
			custom_density: {
				label: "Multiplicador manual",
				type: "number",
				value: 1,
				min: 0.25,
				max: 5,
				step: 0.1
			},
			tile_scale: {
				label: "Escala das faces",
				type: "number",
				value: 0.5,
				min: 0.2,
				max: 1.25,
				step: 0.05
			},
			min_face_size: {
				label: "Tamanho mínimo da face",
				type: "number",
				value: 0.5,
				min: 0.25,
				max: 4,
				step: 0.05
			},
			mass_mult: {
				label: "Massa geral",
				type: "number",
				value: 1,
				min: 0.4,
				max: 3,
				step: 0.05
			},
			joint_mass: {
				label: "Massa da junção",
				type: "number",
				value: 1.06,
				min: 0.4,
				max: 3,
				step: 0.05
			},
			thickness_mult: {
				label: "Espessura",
				type: "number",
				value: 1,
				min: 0.1,
				max: 5,
				step: 0.1
			},
			close_poles: {
				label: "Fechar polos",
				type: "checkbox",
				value: true
			}
		},
		buttons: ["OK", "Cancelar"],
		onConfirm(data) {
			dialog.hide();
			generateOrganicCapsuleSurfaceFromCubes(data);
		}
	});

	dialog.show();
}

function generateOrganicCapsuleSurfaceFromCubes(options = {}) {
	const sel = Cube.selected.filter(c => c instanceof Cube);
	if (!sel.length) {
		Blockbench.showQuickMessage("Selecione pelo menos 1 cubo.");
		return;
	}

	const created = [];
	const parent = sel[0].parent;

	const degToRad = d => d * Math.PI / 180;
	const radToDeg = r => r * 180 / Math.PI;

	function clamp(v, a, b) {
		return Math.max(a, Math.min(b, v));
	}
	function clamp01(v) {
		return clamp(v, 0, 1);
	}
	function lerp(a, b, t) {
		return a + (b - a) * t;
	}
	function smoothstep(t) {
		t = clamp01(t);
		return t * t * (3 - 2 * t);
	}

	function vecAdd(a, b) {
		return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
	}
	function vecSub(a, b) {
		return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	}
	function vecMul(a, s) {
		return [a[0] * s, a[1] * s, a[2] * s];
	}
	function vecDot(a, b) {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	}
	function vecCross(a, b) {
		return [
			a[1] * b[2] - a[2] * b[1],
			a[2] * b[0] - a[0] * b[2],
			a[0] * b[1] - a[1] * b[0]
		];
	}
	function vecLen(a) {
		return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
	}
	function vecNorm(a) {
		const l = vecLen(a) || 1;
		return [a[0] / l, a[1] / l, a[2] / l];
	}
	function vecDist(a, b) {
		return vecLen(vecSub(a, b));
	}

	function getCubeCenter(c) {
		return [
			(c.from[0] + c.to[0]) / 2,
			(c.from[1] + c.to[1]) / 2,
			(c.from[2] + c.to[2]) / 2
		];
	}

	function getCubeSize(c) {
		return [
			Math.abs(c.to[0] - c.from[0]),
			Math.abs(c.to[1] - c.from[1]),
			Math.abs(c.to[2] - c.from[2])
		];
	}

	function cloneFaces(to, from) {
		if (!from.faces || !to.faces) return;

		const props = [
			"uv",
			"rotation",
			"texture",
			"cullface",
			"tint",
			"enabled",
			"material_name"
		];

		for (const key in from.faces) {
			if (!to.faces[key] || !from.faces[key]) continue;
			for (const prop of props) {
				if (from.faces[key][prop] !== undefined) {
					const value = from.faces[key][prop];
					to.faces[key][prop] = Array.isArray(value) ? value.slice() : value;
				}
			}
		}
	}

	function buildStableFrame(dir) {
		const forward = vecNorm(dir);
		let up = [0, 1, 0];

		if (Math.abs(vecDot(forward, up)) > 0.92) {
			up = [1, 0, 0];
		}

		let right = vecNorm(vecCross(up, forward));
		let realUp = vecNorm(vecCross(forward, right));

		if (vecLen(right) < 0.0001 || vecLen(realUp) < 0.0001) {
			up = [0, 0, 1];
			right = vecNorm(vecCross(up, forward));
			realUp = vecNorm(vecCross(forward, right));
		}

		return { forward, right, up: realUp };
	}

	function makeSurfaceFace(base, point, normal, faceW, faceH, thickness, name = "Organic Capsule Face") {
		const horiz = Math.sqrt(normal[0] * normal[0] + normal[2] * normal[2]) || 0.0001;

		const rotX = -radToDeg(Math.atan2(normal[1], horiz));
		const rotY = radToDeg(Math.atan2(normal[0], normal[2]));
		const rotZ = 0;

		const cube = new Cube({
			name,
			from: [
				point[0] - faceW / 2,
				point[1] - faceH / 2,
				point[2] - thickness / 2
			],
			to: [
				point[0] + faceW / 2,
				point[1] + faceH / 2,
				point[2] + thickness / 2
			],
			origin: point.slice(),
			rotation: [rotX, rotY, rotZ],
			color: base.color,
			autouv: base.autouv,
			mirror_uv: base.mirror_uv || false,
			inflate: 0
		});

		cloneFaces(cube, base);
		return cube;
	}

	function ringPoint(center, frame, rx, ry, yawDeg) {
		const yaw = degToRad(yawDeg);
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);

		return vecAdd(
			center,
			vecAdd(
				vecMul(frame.right, rx * cy),
				vecMul(frame.up, ry * sy)
			)
		);
	}

	function ringNormal(frame, rx, ry, yawDeg) {
		const yaw = degToRad(yawDeg);
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);

		return vecNorm(
			vecAdd(
				vecMul(frame.right, cy / Math.max(rx, 0.0001)),
				vecMul(frame.up, sy / Math.max(ry, 0.0001))
			)
		);
	}

	function ellipsoidPoint(center, frame, rx, ry, rz, pitchDeg, yawDeg) {
		const pitch = degToRad(pitchDeg);
		const yaw = degToRad(yawDeg);

		const sx = Math.cos(pitch) * Math.cos(yaw);
		const sy = Math.sin(pitch);
		const sz = Math.cos(pitch) * Math.sin(yaw);

		const local = vecAdd(
			vecMul(frame.right, sx * rx),
			vecAdd(
				vecMul(frame.forward, sy * ry),
				vecMul(frame.up, sz * rz)
			)
		);

		const nx = sx / Math.max(rx, 0.0001);
		const ny = sy / Math.max(ry, 0.0001);
		const nz = sz / Math.max(rz, 0.0001);

		const normal = vecNorm(
			vecAdd(
				vecMul(frame.right, nx),
				vecAdd(
					vecMul(frame.forward, ny),
					vecMul(frame.up, nz)
				)
			)
		);

		return {
			point: vecAdd(center, local),
			normal
		};
	}

	function getAxisData(size) {
		let axis = 0;
		if (size[1] >= size[0] && size[1] >= size[2]) axis = 1;
		else if (size[2] >= size[0] && size[2] >= size[1]) axis = 2;

		if (axis === 0) return { axis, length: size[0], rA: size[1] / 2, rB: size[2] / 2 };
		if (axis === 1) return { axis, length: size[1], rA: size[0] / 2, rB: size[2] / 2 };
		return { axis, length: size[2], rA: size[0] / 2, rB: size[1] / 2 };
	}

	function rotatePointForward(point, rotationDeg) {
		let [x, y, z] = point;
		const rx = degToRad(rotationDeg?.[0] || 0);
		const ry = degToRad(rotationDeg?.[1] || 0);
		const rz = degToRad(rotationDeg?.[2] || 0);

		let c = Math.cos(rx), s = Math.sin(rx);
		let x1 = x;
		let y1 = y * c - z * s;
		let z1 = y * s + z * c;

		c = Math.cos(ry); s = Math.sin(ry);
		let x2 = x1 * c + z1 * s;
		let y2 = y1;
		let z2 = -x1 * s + z1 * c;

		c = Math.cos(rz); s = Math.sin(rz);
		let x3 = x2 * c - y2 * s;
		let y3 = x2 * s + y2 * c;
		let z3 = z2;

		return [x3, y3, z3];
	}

	function localToWorld(localPoint, center, rotation) {
		const p = rotatePointForward(localPoint, rotation);
		return [center[0] + p[0], center[1] + p[1], center[2] + p[2]];
	}

	function localNormalToWorld(localNormal, rotation) {
		return vecNorm(rotatePointForward(localNormal, rotation));
	}

	function mapLocalByAxis(axis, axial, radialA, radialB) {
		if (axis === 0) return [axial, radialA, radialB];
		if (axis === 1) return [radialA, axial, radialB];
		return [radialA, radialB, axial];
	}

	function makeLocalEllipsoidSample(radiusX, radiusY, radiusZ, pitchDeg, yawDeg) {
		const pitch = degToRad(pitchDeg);
		const yaw = degToRad(yawDeg);

		const sx = Math.cos(pitch) * Math.cos(yaw);
		const sy = Math.sin(pitch);
		const sz = Math.cos(pitch) * Math.sin(yaw);

		const px = sx * radiusX;
		const py = sy * radiusY;
		const pz = sz * radiusZ;

		const nx = sx / Math.max(radiusX, 0.0001);
		const ny = sy / Math.max(radiusY, 0.0001);
		const nz = sz / Math.max(radiusZ, 0.0001);

		return {
			point: [px, py, pz],
			normal: vecNorm([nx, ny, nz])
		};
	}

	function makeLocalCapsuleBodySample(axis, rA, rB, axialPos, yawDeg) {
		const yaw = degToRad(yawDeg);
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);

		const localPoint = mapLocalByAxis(axis, axialPos, rA * cy, rB * sy);
		const localNormal = mapLocalByAxis(axis, 0, cy / Math.max(rA, 0.0001), sy / Math.max(rB, 0.0001));

		return {
			point: localPoint,
			normal: vecNorm(localNormal)
		};
	}

	function makeLocalCapsuleCapSample(axis, halfCylinder, capRadius, rA, rB, pitchDeg, yawDeg, sign) {
		const pitch = degToRad(pitchDeg);
		const yaw = degToRad(yawDeg);

		const cp = Math.cos(pitch);
		const sp = Math.sin(pitch);
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);

		const axial = sign * (halfCylinder + capRadius * sp);
		const radialA = rA * cp * cy;
		const radialB = rB * cp * sy;

		const localPoint = mapLocalByAxis(axis, axial, radialA, radialB);
		const localNormal = mapLocalByAxis(
			axis,
			sign * (sp / Math.max(capRadius, 0.0001)),
			(cp * cy) / Math.max(rA, 0.0001),
			(cp * sy) / Math.max(rB, 0.0001)
		);

		return {
			point: localPoint,
			normal: vecNorm(localNormal)
		};
	}

	function orderSkeletonNodes(nodes) {
		if (nodes.length <= 2) return nodes.slice();

		let start = 0;
		let bestScore = Infinity;

		for (let i = 0; i < nodes.length; i++) {
			const ds = [];
			for (let j = 0; j < nodes.length; j++) {
				if (i === j) continue;
				ds.push(vecDist(nodes[i].center, nodes[j].center));
			}
			ds.sort((a, b) => a - b);
			const score = (ds[0] || 0) + (ds[1] || 0) * 0.35;
			if (score < bestScore) {
				bestScore = score;
				start = i;
			}
		}

		let far = start;
		let farDist = -1;
		for (let i = 0; i < nodes.length; i++) {
			const d = vecDist(nodes[start].center, nodes[i].center);
			if (d > farDist) {
				farDist = d;
				far = i;
			}
		}

		const ordered = [];
		const used = new Set();
		let current = far;

		ordered.push(nodes[current]);
		used.add(current);

		while (ordered.length < nodes.length) {
			let best = -1;
			let bestD = Infinity;

			for (let i = 0; i < nodes.length; i++) {
				if (used.has(i)) continue;
				const d = vecDist(nodes[current].center, nodes[i].center);
				if (d < bestD) {
					bestD = d;
					best = i;
				}
			}

			if (best === -1) break;
			ordered.push(nodes[best]);
			used.add(best);
			current = best;
		}

		return ordered;
	}

	function closestPointOnSegment(p, a, b) {
		const ab = vecSub(b, a);
		const abLenSq = vecDot(ab, ab) || 0.0001;
		const t = clamp(vecDot(vecSub(p, a), ab) / abLenSq, 0, 1);
		return {
			point: vecAdd(a, vecMul(ab, t)),
			t
		};
	}

	const densityPresets = {
		low:    { vertical: 1.20, horizontal: 1.15, minRing: 6,  poleLimit: 0.28 },
		medium: { vertical: 0.90, horizontal: 0.92, minRing: 8,  poleLimit: 0.35 },
		high:   { vertical: 0.72, horizontal: 0.78, minRing: 10, poleLimit: 0.42 },
		sealed: { vertical: 0.58, horizontal: 0.62, minRing: 12, poleLimit: 0.50 }
	};

	const selectedPreset = densityPresets[options.density_mode || "medium"] || densityPresets.medium;
	const densityMultiplier = options.use_custom_density ? Math.max(options.custom_density || 1, 0.1) : 1;

	let verticalFactor = selectedPreset.vertical / densityMultiplier;
	let horizontalFactor = selectedPreset.horizontal / densityMultiplier;
	let minRingCount = Math.max(4, Math.round(selectedPreset.minRing * densityMultiplier));
	const poleLimit = selectedPreset.poleLimit;

	const closePoles = options.close_poles !== false;
	const tileScale = Math.max(options.tile_scale || 0.5, 0.1);
	const sphereRatio = Math.max(options.sphere_ratio || 1.18, 1.0);
	const thicknessMult = Math.max(options.thickness_mult || 1, 0.1);
	const surfaceQuality = options.surface_quality || "smooth";
	const minFaceSize = Math.max(options.min_face_size || 0.5, 0.25);

	const massMult = Math.max(options.mass_mult || 1, 0.05);
	const jointMass = Math.max(options.joint_mass || 0.90, 0.05);

	if (surfaceQuality === "smooth") {
		verticalFactor *= 0.8;
		horizontalFactor *= 0.8;
		minRingCount = Math.max(minRingCount, Math.round(selectedPreset.minRing * densityMultiplier * 1.35));
	}
	if (surfaceQuality === "ultra") {
		verticalFactor *= 0.6;
		horizontalFactor *= 0.6;
		minRingCount = Math.max(minRingCount, Math.round(selectedPreset.minRing * densityMultiplier * 1.75));
	}

	function getNodeRadii(node) {
		const axisData = getAxisData(node.size);
		const rA = Math.max(axisData.rA * massMult, 0.25);
		const rB = Math.max(axisData.rB * massMult, 0.25);
		return {
			rx: Math.min(rA, rB),
			ry: Math.max(rA, rB)
		};
	}

	function getFaceSizeFromDiameter(localDiameter) {
		let face = localDiameter * tileScale;
		if (surfaceQuality === "smooth") face *= 0.65;
		if (surfaceQuality === "ultra") face *= 0.45;
		return clamp(face, minFaceSize, Math.max(minFaceSize, localDiameter));
	}

	function getThickness(faceSize, fallbackZ = 1) {
		const thicknessBase = Math.min(Math.max(fallbackZ * 0.05, 0.02), 0.1);
		return thicknessBase * thicknessMult * Math.max(faceSize / Math.max(fallbackZ, 0.0001), 0.75);
	}

	function pointInsideSegmentMass(point, nodeA, nodeB) {
		const p0 = nodeA.center;
		const p1 = nodeB.center;
		const segLen = vecDist(p0, p1);
		if (segLen < 0.0001) return false;

		const seg = closestPointOnSegment(point, p0, p1);
		const frame = buildStableFrame(vecSub(p1, p0));

		const a = getNodeRadii(nodeA);
		const b = getNodeRadii(nodeB);

		const tt = smoothstep(seg.t);
		const rx = lerp(a.rx, b.rx, tt);
		const ry = lerp(a.ry, b.ry, tt);

		const d = vecSub(point, seg.point);
		const x = vecDot(d, frame.right);
		const y = vecDot(d, frame.up);

		const v =
			(x * x) / Math.max(rx * rx, 0.0001) +
			(y * y) / Math.max(ry * ry, 0.0001);

		return v <= 1.0;
	}

	function pointInsideJointMass(point, node, dirPrev, dirNext) {
		const r = getNodeRadii(node);
		const rx = r.rx * jointMass;
		const ry = lerp(r.rx, r.ry, 0.35) * jointMass;
		const rz = r.ry * jointMass;

		let axis;
		if (dirPrev && dirNext) {
			axis = vecNorm(vecAdd(vecNorm(dirPrev), vecNorm(dirNext)));
			if (vecLen(axis) < 0.0001) axis = vecNorm(dirNext);
		} else {
			axis = vecNorm(dirNext || dirPrev || [0, 1, 0]);
		}

		const frame = buildStableFrame(axis);
		const d = vecSub(point, node.center);

		const x = vecDot(d, frame.right);
		const y = vecDot(d, frame.forward);
		const z = vecDot(d, frame.up);

		const v =
			(x * x) / Math.max(rx * rx, 0.0001) +
			(y * y) / Math.max(ry * ry, 0.0001) +
			(z * z) / Math.max(rz * rz, 0.0001);

		return v <= 1.0;
	}

	function pointInsideWholeMass(point, orderedNodes) {
		for (let i = 0; i < orderedNodes.length - 1; i++) {
			if (pointInsideSegmentMass(point, orderedNodes[i], orderedNodes[i + 1])) {
				return true;
			}
		}

		for (let i = 0; i < orderedNodes.length; i++) {
			const prev = i > 0 ? orderedNodes[i - 1] : null;
			const next = i < orderedNodes.length - 1 ? orderedNodes[i + 1] : null;
			const dirPrev = prev ? vecSub(orderedNodes[i].center, prev.center) : null;
			const dirNext = next ? vecSub(next.center, orderedNodes[i].center) : null;

			if (pointInsideJointMass(point, orderedNodes[i], dirPrev, dirNext)) {
				return true;
			}
		}

		return false;
	}

	function isTooCloseToNodeCenter(point, orderedNodes, limit = 0.18) {
		for (const node of orderedNodes) {
			const r = getNodeRadii(node);
			const avgR = (r.rx + r.ry) * 0.5;
			const d = vecDist(point, node.center);
			if (d < avgR * limit) return true;
		}
		return false;
	}

	function shouldKeepSurfaceFace(point, normal, faceSize, orderedNodes) {
		const outerProbe = vecAdd(point, vecMul(normal, faceSize * 0.55));
		const innerProbe = vecSub(point, vecMul(normal, faceSize * 0.95));
		const midProbe = vecSub(point, vecMul(normal, faceSize * 0.35));

		const outside = !pointInsideWholeMass(outerProbe, orderedNodes);
		const inside = pointInsideWholeMass(innerProbe, orderedNodes);
		const midInside = pointInsideWholeMass(midProbe, orderedNodes);

		return outside && inside && midInside;
	}

	function addConnectedSample(baseCube, point, normal, faceSize, thickness, used, name, orderedNodes) {
		if (isTooCloseToNodeCenter(point, orderedNodes, 0.18)) return;
		if (!shouldKeepSurfaceFace(point, normal, faceSize, orderedNodes)) return;

		const key = [
			Math.round(point[0] * 100) / 100,
			Math.round(point[1] * 100) / 100,
			Math.round(point[2] * 100) / 100,
			Math.round(normal[0] * 10) / 10,
			Math.round(normal[1] * 10) / 10,
			Math.round(normal[2] * 10) / 10,
			Math.round(faceSize * 100) / 100
		].join("|");

		if (used.has(key)) return;
		used.add(key);

		const cube = makeSurfaceFace(baseCube, point, normal, faceSize, faceSize, thickness, name);
		cube.addTo(parent);
		cube.init();
		created.push(cube);
	}

	function generateSingleCubeSurface(sourceCube) {
		const localParent = sourceCube.parent;
		const center = getCubeCenter(sourceCube);
		const size = getCubeSize(sourceCube);
		const rotation = (sourceCube.rotation || [0, 0, 0]).slice();

		const sizeSorted = size.slice().sort((a, b) => b - a);
		const ratio = sizeSorted[0] / Math.max(sizeSorted[2], 0.0001);

		const faceW = getFaceSizeFromDiameter(Math.min(size[0], size[1], size[2]));
		const faceH = faceW;
		const thickness = getThickness(faceW, Math.max(size[2], 1));

		const used = new Set();
		const posKey = p => `${Math.round(p[0] * 100) / 100}|${Math.round(p[1] * 100) / 100}|${Math.round(p[2] * 100) / 100}`;

		function addSample(sample, poleName = null) {
			const worldPoint = localToWorld(sample.point, center, rotation);
			const worldNormal = localNormalToWorld(sample.normal, rotation);
			const pk = posKey(worldPoint);
			if (used.has(pk)) return;

			const cube = makeSurfaceFace(
				sourceCube,
				worldPoint,
				worldNormal,
				faceW,
				faceH,
				thickness,
				poleName || "Organic Capsule Face"
			);

			cube.addTo(localParent);
			cube.init();
			created.push(cube);
			used.add(pk);
		}

		if (ratio <= sphereRatio) {
			const radiusX = Math.max(size[0] / 2, 0.0001);
			const radiusY = Math.max(size[1] / 2, 0.0001);
			const radiusZ = Math.max(size[2] / 2, 0.0001);

			const verticalRadius = Math.max(radiusY, 0.0001);
			const pitchStepRad = (faceH * verticalFactor) / verticalRadius;
			let pitchStepDeg = radToDeg(pitchStepRad);
			pitchStepDeg = Math.max(2, Math.min(18, pitchStepDeg));

			for (let pitch = -90; pitch <= 90; pitch += pitchStepDeg) {
				const pitchRad = degToRad(pitch);
				const ringRadiusX = Math.abs(Math.cos(pitchRad) * radiusX);
				const ringRadiusZ = Math.abs(Math.cos(pitchRad) * radiusZ);
				const ringRadius = (ringRadiusX + ringRadiusZ) / 2;

				if (closePoles && ringRadius < faceW * poleLimit) {
					addSample(makeLocalEllipsoidSample(radiusX, radiusY, radiusZ, pitch, 0), "Organic Capsule Pole");
					continue;
				}

				const circumference = 2 * Math.PI * ringRadius;
				let ringCount = Math.ceil(circumference / Math.max(faceW * horizontalFactor, 0.001));
				ringCount = Math.max(minRingCount, ringCount);

				for (let i = 0; i < ringCount; i++) {
					const yaw = (360 / ringCount) * i;
					addSample(makeLocalEllipsoidSample(radiusX, radiusY, radiusZ, pitch, yaw));
				}
			}
			return;
		}

		const axisData = getAxisData(size);
		const axis = axisData.axis;
		const rA = Math.max(axisData.rA, 0.0001);
		const rB = Math.max(axisData.rB, 0.0001);

		const capRadius = Math.max(Math.min(rA, rB), 0.0001);
		const halfLength = Math.max(axisData.length / 2, 0.0001);
		const halfCylinder = Math.max(halfLength - capRadius, 0);

		if (halfCylinder <= 0.0001) {
			const radiusX = Math.max(size[0] / 2, 0.0001);
			const radiusY = Math.max(size[1] / 2, 0.0001);
			const radiusZ = Math.max(size[2] / 2, 0.0001);

			const verticalRadius = Math.max(radiusY, 0.0001);
			const pitchStepRad = (faceH * verticalFactor) / verticalRadius;
			let pitchStepDeg = radToDeg(pitchStepRad);
			pitchStepDeg = Math.max(2, Math.min(18, pitchStepDeg));

			for (let pitch = -90; pitch <= 90; pitch += pitchStepDeg) {
				const pitchRad = degToRad(pitch);
				const ringRadiusX = Math.abs(Math.cos(pitchRad) * radiusX);
				const ringRadiusZ = Math.abs(Math.cos(pitchRad) * radiusZ);
				const ringRadius = (ringRadiusX + ringRadiusZ) / 2;

				if (closePoles && ringRadius < faceW * poleLimit) {
					addSample(makeLocalEllipsoidSample(radiusX, radiusY, radiusZ, pitch, 0), "Organic Capsule Pole");
					continue;
				}

				const circumference = 2 * Math.PI * ringRadius;
				let ringCount = Math.ceil(circumference / Math.max(faceW * horizontalFactor, 0.001));
				ringCount = Math.max(minRingCount, ringCount);

				for (let i = 0; i < ringCount; i++) {
					const yaw = (360 / ringCount) * i;
					addSample(makeLocalEllipsoidSample(radiusX, radiusY, radiusZ, pitch, yaw));
				}
			}
			return;
		}

		const bodyRadius = Math.max((rA + rB) / 2, 0.0001);
		const bodyCircumference = 2 * Math.PI * bodyRadius;
		let bodyRingCount = Math.ceil(bodyCircumference / Math.max(faceW * horizontalFactor, 0.001));
		bodyRingCount = Math.max(minRingCount, bodyRingCount);

		const bodyStepWorld = Math.max(faceH * verticalFactor, 0.2);
		let bodyRows = Math.ceil((halfCylinder * 2) / bodyStepWorld);
		bodyRows = Math.max(2, bodyRows);

		function addBodyRing(axialPos) {
			for (let i = 0; i < bodyRingCount; i++) {
				const yaw = (360 / bodyRingCount) * i;
				addSample(makeLocalCapsuleBodySample(axis, rA, rB, axialPos, yaw));
			}
		}

		function addCapRings(sign) {
			const capStepRad = (faceH * verticalFactor) / Math.max(capRadius, 0.0001);
			let capStepDeg = radToDeg(capStepRad);
			capStepDeg = Math.max(3, Math.min(14, capStepDeg));

			for (let pitch = 0; pitch <= 90; pitch += capStepDeg) {
				const ringScale = Math.cos(degToRad(pitch));
				const ringRadius = bodyRadius * ringScale;

				if (closePoles && ringRadius < faceW * poleLimit) {
					addSample(
						makeLocalCapsuleCapSample(axis, halfCylinder, capRadius, rA, rB, 90, 0, sign),
						"Organic Capsule Pole"
					);
					break;
				}

				const circumference = 2 * Math.PI * ringRadius;
				let ringCount = Math.ceil(circumference / Math.max(faceW * horizontalFactor, 0.001));
				ringCount = Math.max(minRingCount, ringCount);

				for (let i = 0; i < ringCount; i++) {
					const yaw = (360 / ringCount) * i;
					addSample(makeLocalCapsuleCapSample(axis, halfCylinder, capRadius, rA, rB, pitch, yaw, sign));
				}
			}
		}

		addCapRings(-1);

		for (let i = 0; i <= bodyRows; i++) {
			const t = bodyRows <= 0 ? 0 : i / bodyRows;
			const axialPos = -halfCylinder + (halfCylinder * 2) * t;
			addBodyRing(axialPos);
		}

		addCapRings(1);
	}

	function emitSegment(nodeA, nodeB, used, orderedNodes) {
		const p0 = nodeA.center;
		const p1 = nodeB.center;
		const dir = vecSub(p1, p0);
		const segLen = vecLen(dir);
		if (segLen < 0.0001) return;

		const frame = buildStableFrame(dir);
		const a = getNodeRadii(nodeA);
		const b = getNodeRadii(nodeB);

		const avgRadius = (a.rx + a.ry + b.rx + b.ry) / 4;
		const faceSize = getFaceSizeFromDiameter(avgRadius * 2);
		const thickness = getThickness(faceSize, avgRadius * 2);

		const bodyCircumference = 2 * Math.PI * Math.max(avgRadius, 0.0001);
		let bodyRingCount = Math.ceil(bodyCircumference / Math.max(faceSize * horizontalFactor, 0.001));
		bodyRingCount = Math.max(minRingCount, bodyRingCount);

		const bodyStepWorld = Math.max(faceSize * verticalFactor, 0.2);
		let bodyRows = Math.ceil(segLen / bodyStepWorld);
		bodyRows = clamp(bodyRows, 2, 48);

		for (let row = 0; row <= bodyRows; row++) {
			const t = bodyRows <= 0 ? 0 : row / bodyRows;
			const tt = smoothstep(t);

			const center = vecAdd(p0, vecMul(dir, t));
			const rx = lerp(a.rx, b.rx, tt);
			const ry = lerp(a.ry, b.ry, tt);

			for (let i = 0; i < bodyRingCount; i++) {
				const yaw = (360 / bodyRingCount) * i;
				const point = ringPoint(center, frame, rx, ry, yaw);
				const normal = ringNormal(frame, rx, ry, yaw);
				addConnectedSample(nodeA.cube, point, normal, faceSize, thickness, used, "Organic Capsule Segment", orderedNodes);
			}
		}
	}

	function emitJoint(node, dirPrev, dirNext, used, orderedNodes) {
		const r = getNodeRadii(node);
		const rx = r.rx * jointMass;
		const ry = lerp(r.rx, r.ry, 0.35) * jointMass;
		const rz = r.ry * jointMass;

		let axis;
		if (dirPrev && dirNext) {
			axis = vecNorm(vecAdd(vecNorm(dirPrev), vecNorm(dirNext)));
			if (vecLen(axis) < 0.0001) axis = vecNorm(dirNext);
		} else {
			axis = vecNorm(dirNext || dirPrev || [0, 1, 0]);
		}

		const frame = buildStableFrame(axis);
		const faceSize = getFaceSizeFromDiameter(Math.max(rx, ry, rz) * 2);
		const thickness = getThickness(faceSize, Math.max(rx, ry, rz) * 2);

		const verticalRadius = Math.max(ry, 0.0001);
		const pitchStepRad = (faceSize * verticalFactor) / verticalRadius;
		let pitchStepDeg = radToDeg(pitchStepRad);
		pitchStepDeg = Math.max(3, Math.min(18, pitchStepDeg));

		for (let pitch = -65; pitch <= 65; pitch += pitchStepDeg) {
			const pitchRad = degToRad(pitch);
			const ringRadiusX = Math.abs(Math.cos(pitchRad) * rx);
			const ringRadiusZ = Math.abs(Math.cos(pitchRad) * rz);
			const ringRadius = (ringRadiusX + ringRadiusZ) / 2;

			if (closePoles && ringRadius < faceSize * poleLimit) {
				const sample = ellipsoidPoint(node.center, frame, rx, ry, rz, pitch, 0);
				addConnectedSample(node.cube, sample.point, sample.normal, faceSize, thickness, used, "Organic Capsule Joint", orderedNodes);
				continue;
			}

			const circumference = 2 * Math.PI * Math.max(ringRadius, 0.0001);
			let ringCount = Math.ceil(circumference / Math.max(faceSize * horizontalFactor, 0.001));
			ringCount = Math.max(minRingCount, ringCount);

			for (let i = 0; i < ringCount; i++) {
				const yaw = (360 / ringCount) * i;
				const sample = ellipsoidPoint(node.center, frame, rx, ry, rz, pitch, yaw);
				addConnectedSample(node.cube, sample.point, sample.normal, faceSize, thickness, used, "Organic Capsule Joint", orderedNodes);
			}
		}
	}

	function emitEndCap(node, outwardDir, used, orderedNodes) {
		if (!closePoles) return;

		const r = getNodeRadii(node);
		const localJointMass = Math.min(jointMass, 0.96);
		const rx = r.rx * localJointMass;
		const ry = ((r.rx + r.ry) * 0.5) * localJointMass;
		const rz = r.ry * localJointMass;

		const frame = buildStableFrame(outwardDir);
		const faceSize = getFaceSizeFromDiameter(Math.max(rx, ry, rz) * 2);
		const thickness = getThickness(faceSize, Math.max(rx, ry, rz) * 2);

		const verticalRadius = Math.max(ry, 0.0001);
		const pitchStepRad = (faceSize * verticalFactor) / verticalRadius;
		let pitchStepDeg = radToDeg(pitchStepRad);
		pitchStepDeg = Math.max(4, Math.min(18, pitchStepDeg));

		for (let pitch = 0; pitch <= 90; pitch += pitchStepDeg) {
			const ringRadiusX = Math.abs(Math.cos(degToRad(pitch)) * rx);
			const ringRadiusZ = Math.abs(Math.cos(degToRad(pitch)) * rz);
			const ringRadius = (ringRadiusX + ringRadiusZ) / 2;

			if (ringRadius < faceSize * poleLimit) {
				const sample = ellipsoidPoint(node.center, frame, rx, ry, rz, 90, 0);
				addConnectedSample(node.cube, sample.point, sample.normal, faceSize, thickness, used, "Organic Capsule Pole", orderedNodes);
				break;
			}

			const circumference = 2 * Math.PI * Math.max(ringRadius, 0.0001);
			let ringCount = Math.ceil(circumference / Math.max(faceSize * horizontalFactor, 0.001));
			ringCount = Math.max(minRingCount, ringCount);

			for (let i = 0; i < ringCount; i++) {
				const yaw = (360 / ringCount) * i;
				const sample = ellipsoidPoint(node.center, frame, rx, ry, rz, pitch, yaw);
				addConnectedSample(node.cube, sample.point, sample.normal, faceSize, thickness, used, "Organic Capsule Pole", orderedNodes);
			}
		}
	}

	Undo.initEdit({ elements: created, outliner: true, selection: true });

	if (sel.length === 1) {
		generateSingleCubeSurface(sel[0]);
	} else {
		const nodes = sel.map(c => ({
			cube: c,
			center: getCubeCenter(c),
			size: getCubeSize(c),
			rotation: (c.rotation || [0, 0, 0]).slice()
		}));

		const ordered = orderSkeletonNodes(nodes);
		const used = new Set();

		for (let i = 0; i < ordered.length - 1; i++) {
			emitSegment(ordered[i], ordered[i + 1], used, ordered);
		}

		for (let i = 0; i < ordered.length; i++) {
			const prev = i > 0 ? ordered[i - 1] : null;
			const next = i < ordered.length - 1 ? ordered[i + 1] : null;

			const dirPrev = prev ? vecSub(ordered[i].center, prev.center) : null;
			const dirNext = next ? vecSub(next.center, ordered[i].center) : null;

			emitJoint(ordered[i], dirPrev, dirNext, used, ordered);
		}

		if (ordered.length >= 2) {
			emitEndCap(
				ordered[0],
				vecSub(ordered[0].center, ordered[1].center),
				used,
				ordered
			);

			emitEndCap(
				ordered[ordered.length - 1],
				vecSub(ordered[ordered.length - 1].center, ordered[ordered.length - 2].center),
				used,
				ordered
			);
		}
	}

	Undo.finishEdit("Generate Organic Capsule Surface From Cubes");
	Canvas.updateAll();
	Blockbench.showQuickMessage(
		`Organic Capsule Surface: ${created.length} faces. Modo: ${options.density_mode || "medium"}`
	);
}

	// ===========================
	// Organic Sphere Fusion
	// ===========================
	function openOrganicSphereFusionDialog() {
		const dialog = new Dialog({
			id: "a_preview_organic_sphere_fusion_dialogue",
			title: "Organic Sphere Fusion",
			form: {
				density_mode: {
					label: "Densidade",
					type: "select",
					options: {
						low: "Baixa",
						medium: "Média",
						high: "Alta",
						sealed: "Sem buracos"
					},
					value: "medium"
				},
				fusion_strength: {
					label: "Força da fusão",
					type: "number",
					value: 1.0,
					min: 0.1,
					max: 4,
					step: 0.1
				},
				threshold: {
					label: "Threshold",
					type: "number",
					value: 1.0,
					min: 0.1,
					max: 5,
					step: 0.05
				},
				thickness_mult: {
					label: "Espessura",
					type: "number",
					value: 1,
					min: 0.1,
					max: 5,
					step: 0.1
				},
				close_poles: {
					label: "Fechar polos",
					type: "checkbox",
					value: true
				}
			},
			buttons: ["OK", "Cancelar"],
			onConfirm(data) {
				dialog.hide();
				generateOrganicSphereFusionFromSelection(data);
			}
		});

		dialog.show();
	}

	function generateOrganicSphereFusionFromSelection(options = {}) {
		const sel = Cube.selected.filter(c => c instanceof Cube);
		if (!sel.length) {
			Blockbench.showQuickMessage("Selecione pelo menos 1 cubo.");
			return;
		}

		const parent = sel[0].parent;
		const base = sel[0];
		const created = [];

		const degToRad = d => d * Math.PI / 180;
		const radToDeg = r => r * 180 / Math.PI;

		function getCubeCenter(c) {
			return [
				(c.from[0] + c.to[0]) / 2,
				(c.from[1] + c.to[1]) / 2,
				(c.from[2] + c.to[2]) / 2
			];
		}

		function getCubeSize(c) {
			return [
				Math.abs(c.to[0] - c.from[0]),
				Math.abs(c.to[1] - c.from[1]),
				Math.abs(c.to[2] - c.from[2])
			];
		}

		function cloneFaces(to, from) {
			if (!from.faces || !to.faces) return;
			const props = [
				"uv",
				"rotation",
				"texture",
				"cullface",
				"tint",
				"enabled",
				"material_name"
			];
			for (const key in from.faces) {
				if (!to.faces[key] || !from.faces[key]) continue;
				for (const prop of props) {
					if (from.faces[key][prop] !== undefined) {
						const value = from.faces[key][prop];
						to.faces[key][prop] = Array.isArray(value) ? value.slice() : value;
					}
				}
			}
		}

		function rotateVector(v, rotDeg) {
			let [x, y, z] = v;
			const rx = degToRad(rotDeg?.[0] || 0);
			const ry = degToRad(rotDeg?.[1] || 0);
			const rz = degToRad(rotDeg?.[2] || 0);

			let c = Math.cos(rx), s = Math.sin(rx);
			let y1 = y * c - z * s;
			let z1 = y * s + z * c;
			let x1 = x;

			c = Math.cos(ry); s = Math.sin(ry);
			let x2 = x1 * c + z1 * s;
			let z2 = -x1 * s + z1 * c;
			let y2 = y1;

			c = Math.cos(rz); s = Math.sin(rz);
			let x3 = x2 * c - y2 * s;
			let y3 = x2 * s + y2 * c;
			let z3 = z2;

			return [x3, y3, z3];
		}

		function rotatePointInverse(point, rotationDeg) {
			let [x, y, z] = point;
			const rx = degToRad(-(rotationDeg?.[0] || 0));
			const ry = degToRad(-(rotationDeg?.[1] || 0));
			const rz = degToRad(-(rotationDeg?.[2] || 0));

			let c = Math.cos(rz), s = Math.sin(rz);
			let x1 = x * c - y * s;
			let y1 = x * s + y * c;
			let z1 = z;

			c = Math.cos(ry); s = Math.sin(ry);
			let x2 = x1 * c + z1 * s;
			let y2 = y1;
			let z2 = -x1 * s + z1 * c;

			c = Math.cos(rx); s = Math.sin(rx);
			let x3 = x2;
			let y3 = y2 * c - z2 * s;
			let z3 = y2 * s + z2 * c;

			return [x3, y3, z3];
		}

		const densityPresets = {
			low:    { vertical: 1.20, horizontal: 1.15, minRing: 6,  poleLimit: 0.28 },
			medium: { vertical: 0.90, horizontal: 0.92, minRing: 8,  poleLimit: 0.35 },
			high:   { vertical: 0.72, horizontal: 0.78, minRing: 10, poleLimit: 0.42 },
			sealed: { vertical: 0.58, horizontal: 0.62, minRing: 12, poleLimit: 0.50 }
		};

		const preset = densityPresets[options.density_mode || "medium"] || densityPresets.medium;
		const fusionStrength = Math.max(options.fusion_strength || 1, 0.01);
		const threshold = Math.max(options.threshold || 1, 0.01);
		const closePoles = options.close_poles !== false;

		const cubesData = sel.map(c => {
			const center = getCubeCenter(c);
			const size = getCubeSize(c);

			return {
				cube: c,
				center,
				size,
				radiusX: Math.max(size[0] / 2, 0.0001),
				radiusY: Math.max(size[1] / 2, 0.0001),
				radiusZ: Math.max(size[2] / 2, 0.0001),
				rotation: (c.rotation || [0, 0, 0]).slice()
			};
		});

		let minSize = Infinity;
		let maxRadius = 0;
		let globalCenter = [0, 0, 0];

		for (const c of cubesData) {
			minSize = Math.min(minSize, c.size[0], c.size[1], c.size[2]);
			maxRadius = Math.max(maxRadius, c.radiusX, c.radiusY, c.radiusZ);
			globalCenter[0] += c.center[0];
			globalCenter[1] += c.center[1];
			globalCenter[2] += c.center[2];
		}

		globalCenter[0] /= cubesData.length;
		globalCenter[1] /= cubesData.length;
		globalCenter[2] /= cubesData.length;

		const faceW = Math.max(minSize, 0.5);
		const faceH = Math.max(minSize, 0.5);
		const thicknessBase = Math.min(Math.max(faceW * 0.05, 0.02), 0.15);
		const thickness = thicknessBase * Math.max(options.thickness_mult || 1, 0.1);

		function ellipsoidFieldAt(worldPoint, data) {
			const rel = [
				worldPoint[0] - data.center[0],
				worldPoint[1] - data.center[1],
				worldPoint[2] - data.center[2]
			];

			const local = rotatePointInverse(rel, data.rotation);

			const nx = local[0] / data.radiusX;
			const ny = local[1] / data.radiusY;
			const nz = local[2] / data.radiusZ;

			const distNorm = Math.sqrt(nx * nx + ny * ny + nz * nz);

			if (distNorm <= 1) {
				return 1 + (1 - distNorm) * fusionStrength;
			}

			return 1 / Math.max(Math.pow(distNorm, 2 / fusionStrength), 0.0001);
		}

		function fieldAt(worldPoint) {
			let sum = 0;
			for (const c of cubesData) {
				sum += ellipsoidFieldAt(worldPoint, c);
			}
			return sum;
		}

		function estimateNormal(point) {
			const e = Math.max(minSize * 0.15, 0.1);

			const dx = fieldAt([point[0] + e, point[1], point[2]]) - fieldAt([point[0] - e, point[1], point[2]]);
			const dy = fieldAt([point[0], point[1] + e, point[2]]) - fieldAt([point[0], point[1] - e, point[2]]);
			const dz = fieldAt([point[0], point[1], point[2] + e]) - fieldAt([point[0], point[1], point[2] - e]);

			const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
			return [dx / len, dy / len, dz / len];
		}

		function refineSurface(a, b) {
			let inside = a.slice();
			let outside = b.slice();

			for (let i = 0; i < 10; i++) {
				const mid = [
					(inside[0] + outside[0]) / 2,
					(inside[1] + outside[1]) / 2,
					(inside[2] + outside[2]) / 2
				];

				if (fieldAt(mid) >= threshold) {
					inside = mid;
				} else {
					outside = mid;
				}
			}

			return [
				(inside[0] + outside[0]) / 2,
				(inside[1] + outside[1]) / 2,
				(inside[2] + outside[2]) / 2
			];
		}

		function maxSupportDistance(dir) {
			let maxD = 0;
			for (const c of cubesData) {
				const localDir = rotatePointInverse(dir, c.rotation);
				const d = Math.sqrt(
					Math.pow(localDir[0] * c.radiusX, 2) +
					Math.pow(localDir[1] * c.radiusY, 2) +
					Math.pow(localDir[2] * c.radiusZ, 2)
				);

				const dx = c.center[0] - globalCenter[0];
				const dy = c.center[1] - globalCenter[1];
				const dz = c.center[2] - globalCenter[2];
				const centerOffset = Math.sqrt(dx * dx + dy * dy + dz * dz);

				maxD = Math.max(maxD, d + centerOffset + maxRadius * 2);
			}
			return maxD;
		}

		function findSurfaceOnRay(dir) {
			const maxDist = Math.max(maxSupportDistance(dir), maxRadius * 4, 12);
			const step = Math.max(minSize * 0.2, 0.15);

			let prevPoint = globalCenter.slice();
			let prevField = fieldAt(prevPoint);
			let insideFound = prevField >= threshold;

			for (let t = step; t <= maxDist; t += step) {
				const p = [
					globalCenter[0] + dir[0] * t,
					globalCenter[1] + dir[1] * t,
					globalCenter[2] + dir[2] * t
				];

				const f = fieldAt(p);

				if (!insideFound) {
					if (f >= threshold) {
						insideFound = true;
						prevPoint = p;
						prevField = f;
					}
				} else {
					if (f < threshold) {
						return refineSurface(prevPoint, p);
					}
					prevPoint = p;
					prevField = f;
				}
			}

			return null;
		}

		function makeFace(point, normal) {
			const horiz = Math.sqrt(normal[0] * normal[0] + normal[2] * normal[2]) || 0.0001;
			const rotX = -radToDeg(Math.atan2(normal[1], horiz));
			const rotY = radToDeg(Math.atan2(normal[0], normal[2]));

			const cube = new Cube({
				name: "Organic Fusion Face",
				from: [
					point[0] - faceW / 2,
					point[1] - faceH / 2,
					point[2] - thickness / 2
				],
				to: [
					point[0] + faceW / 2,
					point[1] + faceH / 2,
					point[2] + thickness / 2
				],
				origin: point.slice(),
				rotation: [rotX, rotY, 0],
				color: base.color,
				autouv: base.autouv,
				mirror_uv: base.mirror_uv || false,
				inflate: 0
			});

			cloneFaces(cube, base);
			return cube;
		}

		const verticalRadius = Math.max(maxRadius, 0.0001);
		const pitchStepRad = (faceH * preset.vertical) / verticalRadius;
		let pitchStepDeg = radToDeg(pitchStepRad);
		pitchStepDeg = Math.max(2, Math.min(18, pitchStepDeg));

		const used = new Set();
		const key = (a, b) => `${Math.round(a * 100) / 100}|${Math.round(b * 100) / 100}`;
		const posKey = p => `${Math.round(p[0] * 4)}|${Math.round(p[1] * 4)}|${Math.round(p[2] * 4)}`;

		Undo.initEdit({ elements: created, outliner: true, selection: true });

		for (let pitch = -90; pitch <= 90; pitch += pitchStepDeg) {
			const pitchRad = degToRad(pitch);
			const ringRadius = Math.abs(Math.cos(pitchRad)) * maxRadius;

			if (closePoles && ringRadius < faceW * preset.poleLimit) {
				const dir = [
					Math.cos(pitchRad),
					Math.sin(pitchRad),
					0
				];

				const hit = findSurfaceOnRay(dir);
				if (hit) {
					const pk = posKey(hit);
					if (!used.has(pk)) {
						const normal = estimateNormal(hit);
						const cube = makeFace(hit, normal);
						if (Math.abs(pitch) > 85) cube.name = "Organic Fusion Pole";
						cube.addTo(parent);
						cube.init();
						created.push(cube);
						used.add(pk);
					}
				}
				continue;
			}

			const circumference = 2 * Math.PI * Math.max(ringRadius, faceW);
			let ringCount = Math.ceil(circumference / Math.max(faceW * preset.horizontal, 0.001));
			ringCount = Math.max(preset.minRing, ringCount);

			for (let i = 0; i < ringCount; i++) {
				const yaw = (360 / ringCount) * i;
				const yawRad = degToRad(yaw);
				const angKey = key(pitch, yaw);
				if (used.has(angKey)) continue;

				const dir = [
					Math.cos(pitchRad) * Math.cos(yawRad),
					Math.sin(pitchRad),
					Math.cos(pitchRad) * Math.sin(yawRad)
				];

				const hit = findSurfaceOnRay(dir);
				if (!hit) continue;

				const pk = posKey(hit);
				if (used.has(pk)) continue;

				const normal = estimateNormal(hit);
				const cube = makeFace(hit, normal);

				cube.addTo(parent);
				cube.init();

				created.push(cube);
				used.add(angKey);
				used.add(pk);
			}
		}

		Undo.finishEdit("Generate Organic Sphere Fusion");
		Canvas.updateAll();
		Blockbench.showQuickMessage(`Organic Sphere Fusion: ${created.length} faces.`);
	}

	// ===========================
	// 
	// ===========================
	function openFilledSphereSurfaceDialog() {
		const dialog = new Dialog({
			id: "a_generate_filled_sphere_surface_dialogue",
			title: "Generate Filled Sphere Surface",
			form: {
				density_mode: {
					label: "Densidade",
					type: "select",
					options: {
						low: "Baixa",
						medium: "Média",
						high: "Alta",
						sealed: "Sem buracos"
					},
					value: "medium"
				},
				use_custom_density: {
					label: "Usar multiplicador manual",
					type: "checkbox",
					value: false
				},
				custom_density: {
					label: "Multiplicador manual",
					type: "number",
					value: 1,
					min: 0.25,
					max: 5,
					step: 0.1
				},
				thickness_mult: {
					label: "Multiplicador de espessura",
					type: "number",
					value: 1,
					min: 0.1,
					max: 5,
					step: 0.1
				},
				close_poles: {
					label: "Fechar polos",
					type: "checkbox",
					value: true
				}
			},
			buttons: ["OK", "Cancelar"],
			onConfirm(data) {
				dialog.hide();
				generateFilledSphereSurfaceFromSkeleton(data);
			}
		});

		dialog.show();
	}
	
	function generateFilledSphereSurfaceFromSkeleton(options = {}) {
		const sel = Cube.selected.filter(c => c instanceof Cube);
		if (sel.length < 4) {
			Blockbench.showQuickMessage("Selecione pelo menos 4 cubos-guia.");
			return;
		}

		const parent = sel[0].parent;
		const created = [];

		const degToRad = d => d * Math.PI / 180;
		const radToDeg = r => r * 180 / Math.PI;

		function getCubeCenter(c) {
			return [
				(c.from[0] + c.to[0]) / 2,
				(c.from[1] + c.to[1]) / 2,
				(c.from[2] + c.to[2]) / 2
			];
		}

		function avg(arr) {
			return arr.reduce((a, b) => a + b, 0) / arr.length;
		}

		function dist(a, b) {
			const dx = a[0] - b[0];
			const dy = a[1] - b[1];
			const dz = a[2] - b[2];
			return Math.sqrt(dx * dx + dy * dy + dz * dz);
		}

		function cloneFaces(to, from) {
			if (!from.faces || !to.faces) return;

			const props = [
				"uv",
				"rotation",
				"texture",
				"cullface",
				"tint",
				"enabled",
				"material_name"
			];

			for (const key in from.faces) {
				if (!to.faces[key] || !from.faces[key]) continue;
				for (const prop of props) {
					if (from.faces[key][prop] !== undefined) {
						const value = from.faces[key][prop];
						to.faces[key][prop] = Array.isArray(value) ? value.slice() : value;
					}
				}
			}
		}

		function makeEllipsoidFace(base, center, radiusX, radiusY, radiusZ, pitchDeg, yawDeg, faceW, faceH, thickness) {
			const pitch = degToRad(pitchDeg);
			const yaw = degToRad(yawDeg);

			const sx = Math.cos(pitch) * Math.cos(yaw);
			const sy = Math.sin(pitch);
			const sz = Math.cos(pitch) * Math.sin(yaw);

			const px = center[0] + sx * radiusX;
			const py = center[1] + sy * radiusY;
			const pz = center[2] + sz * radiusZ;

			const nx = sx / Math.max(radiusX, 0.0001);
			const ny = sy / Math.max(radiusY, 0.0001);
			const nz = sz / Math.max(radiusZ, 0.0001);

			const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
			const nnx = nx / nLen;
			const nny = ny / nLen;
			const nnz = nz / nLen;

			const horiz = Math.sqrt(nnx * nnx + nnz * nnz);

			const rotX = -radToDeg(Math.atan2(nny, horiz));
			const rotY = radToDeg(Math.atan2(nnx, nnz));
			const rotZ = 0;

			const cube = new Cube({
				name: "Sphere Face",
				from: [
					px - faceW / 2,
					py - faceH / 2,
					pz - thickness / 2
				],
				to: [
					px + faceW / 2,
					py + faceH / 2,
					pz + thickness / 2
				],
				origin: [px, py, pz],
				rotation: [rotX, rotY, rotZ],
				color: base.color,
				autouv: base.autouv,
				mirror_uv: base.mirror_uv || false,
				inflate: 0
			});

			cloneFaces(cube, base);
			return cube;
		}

		let guides = sel.map(c => ({
			cube: c,
			pos: getCubeCenter(c)
		}));

		if (guides.length >= 7) {
			const rawCenter = [
				avg(guides.map(g => g.pos[0])),
				avg(guides.map(g => g.pos[1])),
				avg(guides.map(g => g.pos[2]))
			];

			guides.sort((a, b) => dist(a.pos, rawCenter) - dist(b.pos, rawCenter));
			guides.shift();
		}

		const points = guides.map(g => g.pos);

		const minX = Math.min(...points.map(p => p[0]));
		const maxX = Math.max(...points.map(p => p[0]));
		const minY = Math.min(...points.map(p => p[1]));
		const maxY = Math.max(...points.map(p => p[1]));
		const minZ = Math.min(...points.map(p => p[2]));
		const maxZ = Math.max(...points.map(p => p[2]));

		const center = [
			(minX + maxX) / 2,
			(minY + maxY) / 2,
			(minZ + maxZ) / 2
		];

		const radiusX = Math.max((maxX - minX) / 2, 0.0001);
		const radiusY = Math.max((maxY - minY) / 2, 0.0001);
		const radiusZ = Math.max((maxZ - minZ) / 2, 0.0001);

		const base = sel[0];
		const sizeX = Math.abs(base.to[0] - base.from[0]);
		const sizeY = Math.abs(base.to[1] - base.from[1]);
		const sizeZ = Math.abs(base.to[2] - base.from[2]);

		const faceW = Math.max(sizeX, 1);
		const faceH = Math.max(sizeY, 1);

		// presets de densidade
		const densityPresets = {
			low:    { vertical: 1.20, horizontal: 1.15, minRing: 6, poleLimit: 0.28 },
			medium: { vertical: 0.90, horizontal: 0.92, minRing: 8, poleLimit: 0.35 },
			high:   { vertical: 0.72, horizontal: 0.78, minRing: 10, poleLimit: 0.42 },
			sealed: { vertical: 0.58, horizontal: 0.62, minRing: 12, poleLimit: 0.50 }
		};

		const selectedPreset = densityPresets[options.density_mode || "medium"] || densityPresets.medium;
		const densityMultiplier = options.use_custom_density ? Math.max(options.custom_density || 1, 0.1) : 1;

		const verticalFactor = selectedPreset.vertical / densityMultiplier;
		const horizontalFactor = selectedPreset.horizontal / densityMultiplier;
		const minRingCount = Math.max(4, Math.round(selectedPreset.minRing * densityMultiplier));
		const poleLimit = selectedPreset.poleLimit;

		const thicknessBase = Math.min(Math.max(sizeZ * 0.05, 0.02), 0.1);
		const thickness = thicknessBase * Math.max(options.thickness_mult || 1, 0.1);

		const verticalRadius = Math.max(radiusY, 0.0001);
		const pitchStepRad = (faceH * verticalFactor) / verticalRadius;
		let pitchStepDeg = radToDeg(pitchStepRad);
		pitchStepDeg = Math.max(2, Math.min(18, pitchStepDeg));

		const closePoles = options.close_poles !== false;

		const used = new Set();
		const key = (a, b) => `${Math.round(a * 100) / 100}|${Math.round(b * 100) / 100}`;

		Undo.initEdit({ elements: created, outliner: true, selection: true });

		for (let pitch = -90; pitch <= 90; pitch += pitchStepDeg) {
			const pitchRad = degToRad(pitch);

			const ringRadiusX = Math.abs(Math.cos(pitchRad) * radiusX);
			const ringRadiusZ = Math.abs(Math.cos(pitchRad) * radiusZ);
			const ringRadius = (ringRadiusX + ringRadiusZ) / 2;

			if (closePoles && ringRadius < faceW * poleLimit) {
				const k = key(pitch, 0);
				if (!used.has(k)) {
					const cube = makeEllipsoidFace(
						base,
						center,
						radiusX,
						radiusY,
						radiusZ,
						pitch,
						0,
						faceW,
						faceH,
						thickness
					);

					if (Math.abs(pitch) > 85) cube.name = "Sphere Pole";

					cube.addTo(parent);
					cube.init();
					created.push(cube);
					used.add(k);
				}
				continue;
			}

			const circumference = 2 * Math.PI * ringRadius;
			let ringCount = Math.ceil(circumference / Math.max(faceW * horizontalFactor, 0.001));
			ringCount = Math.max(minRingCount, ringCount);

			for (let i = 0; i < ringCount; i++) {
				const yaw = (360 / ringCount) * i;
				const k = key(pitch, yaw);
				if (used.has(k)) continue;

				const cube = makeEllipsoidFace(
					base,
					center,
					radiusX,
					radiusY,
					radiusZ,
					pitch,
					yaw,
					faceW,
					faceH,
					thickness
				);

				cube.addTo(parent);
				cube.init();

				created.push(cube);
				used.add(k);
			}
		}

		Undo.finishEdit("Generate Filled Sphere Surface From Skeleton");
		Canvas.updateAll();
		Blockbench.showQuickMessage(
			`Superfície gerada: ${created.length} faces. Modo: ${options.density_mode || "medium"}`
		);
	}

	// ===========================
	// 
	// ===========================
	function fillSphereFromSelection() {
		const cubes = getSelectedCubes();
		if (cubes.length < 2) return;

		const parent = cubes[0].parent;

		const centers = cubes.map(c => centerOf(c));

		const avg = [0,0,0];

		centers.forEach(p=>{
			avg[0]+=p[0];
			avg[1]+=p[1];
			avg[2]+=p[2];
		});

		avg[0]/=centers.length;
		avg[1]/=centers.length;
		avg[2]/=centers.length;

		let radius = 0;

		centers.forEach(p=>{
			const d = Math.hypot(
				p[0]-avg[0],
				p[1]-avg[1],
				p[2]-avg[2]
			);
			radius = Math.max(radius,d);
		});

		const size = sizeOf(cubes[0]);

		const step = size[0];

		const _created = [];

		Undo.initEdit({
			outliner:true,
			elements:_created
		});

		for(let x=-radius; x<=radius; x+=step){
		for(let y=-radius; y<=radius; y+=step){
		for(let z=-radius; z<=radius; z+=step){

			if(x*x+y*y+z*z <= radius*radius){

				const px = avg[0]+x;
				const py = avg[1]+y;
				const pz = avg[2]+z;

				const cube = new Cube({
					name:"Sphere Fill Cube",
					from:[
						px-size[0]/2,
						py-size[1]/2,
						pz-size[2]/2
					],
					to:[
						px+size[0]/2,
						py+size[1]/2,
						pz+size[2]/2
					],
					origin:[px,py,pz]
				});

				cube.addTo(parent);
				cube.init();

				_created.push(cube);
			}

		}}}

		Undo.finishEdit("3D Sphere Fill");

		Canvas.updateAll();
	}

	// ===========================
	// 
	// ===========================
	function createArcTouchingCube() {
		const cubes = getSelectedCubes();
		if (!cubes.length) return;

		const base = cubes[0];
		const parent = base.parent;

		const center = centerOf(base);
		const size = sizeOf(base);

		// raio exatamente encostando
		const radius = Math.max(size[0], size[1]);

		const stepLen = size[0] * 0.95; // lógica tipo Fill Arc Gaps

		const arcLength = Math.PI * 2 * radius;

		let segments = Math.ceil(arcLength / stepLen);

		segments = Math.max(8, Math.min(segments, 1000));

		const _created = [];

		Undo.initEdit({
			outliner: true,
			elements: _created,
			selection: true
		});

		for (let i = 0; i < segments; i++) {

			const angle = (Math.PI * 2 / segments) * i;

			const px = center[0] + Math.cos(angle) * radius;
			const py = center[1] + Math.sin(angle) * radius;
			const pz = center[2];

			const rotZ = rad2deg(angle + Math.PI / 2);

			const cube = new Cube({
				name: "Arc Cube",
				from: [
					px - size[0]/2,
					py - size[1]/2,
					pz - size[2]/2
				],
				to: [
					px + size[0]/2,
					py + size[1]/2,
					pz + size[2]/2
				],
				origin: [px, py, pz],
				rotation: [0, 0, rotZ]
			});

			cube.addTo(parent);
			cube.init();

			_created.push(cube);
		}

		Undo.finishEdit("Create Arc Around Cube (Fill)");

		Canvas.updateAll();
	}

	// ===========================
	// Generate Hair Strand
	// ===========================
	function generateHairStrand(length = 6, offset = 0.6, angle = 8) {

		const cubes = getSelectedCubes();
		if (!cubes.length) return;

		const base = cubes[0];
		const parent = base.parent;

		const _created = [];

		Undo.initEdit({
			outliner: true,
			elements: _created,
			selection: true
		});

		for (let i = 1; i < length; i++) {

			const from = [...base.from];
			const to = [...base.to];

			from[1] -= offset * i;
			to[1] -= offset * i;

			const cx = (from[0] + to[0]) / 2;
			const cy = (from[1] + to[1]) / 2;
			const cz = (from[2] + to[2]) / 2;

			const cube = new Cube({
				name: "Hair Strand",
				from: from,
				to: to,
				origin: [cx, cy, cz],
				rotation: [angle * i, 0, 0]
			});

			cube.addTo(parent);
			cube.init();

			_created.push(cube);
		}

		Undo.finishEdit("Generate Hair Strand");
		Canvas.updateAll();
	}

	// ===========================
	// Radial Hair
	// ===========================
	function radialHair(count = 8) {

		const cubes = getSelectedCubes();
		if (!cubes.length) return;

		const base = cubes[0];
		const parent = base.parent;

		const center = centerOf(base);

		const _created = [];

		Undo.initEdit({
			outliner: true,
			elements: _created,
			selection: true
		});

		for (let i = 1; i < count; i++) {

			const cube = new Cube({
				name: "Radial Hair",
				from: [...base.from],
				to: [...base.to],
				origin: center.slice(),
				rotation: [
					base.rotation?.[0] || 0,
					(base.rotation?.[1] || 0) + (360 / count) * i,
					base.rotation?.[2] || 0
				]
			});

			cube.addTo(parent);
			cube.init();

			_created.push(cube);
		}

		Undo.finishEdit("Radial Hair");
		Canvas.updateAll();
	}

	// ===========================
	// Hair Curve Tool
	// ===========================
	function hairCurve(angleStep = 5) {

		const cubes = getSelectedCubes();
		if (!cubes.length) return;

		Undo.initEdit({ elements: cubes });

		cubes.forEach((c, i) => {

			if (!c.rotation) c.rotation = [0,0,0];

			c.rotation[0] += angleStep * i;

		});

		Undo.finishEdit("Hair Curve");

		try {
			Canvas.updateView({
				elements: cubes,
				element_aspects: { transform: true }
			});
		} catch(e){}

		Canvas.updateAll();
	}

	// ===========================
	// Bedrock Inflate Fix
	// ===========================
	function bedrockInflateFix() {

		const cubes = getSelectedCubes();

		if (!cubes || cubes.length === 0) {
			Blockbench.showQuickMessage?.("Selecione pelo menos um cube.", 1500);
			return;
		}

		Undo.initEdit({ elements: cubes });

		cubes.forEach(c => {

			// aumenta o tamanho em 1
			for (let i = 0; i < 3; i++) {
				c.to[i] += 1;
			}

			// desloca posição -0.5 (mantém centro visual)
			for (let i = 0; i < 3; i++) {
				c.from[i] -= 0.5;
				c.to[i] -= 0.5;
			}

			// aplica inflate negativo
			if (c.inflate === undefined) c.inflate = 0;
			c.inflate -= 0.5;

		});

		Undo.finishEdit("Bedrock Inflate Fix");

		try { Canvas.updateView({ elements: cubes, element_aspects: { geometry: true } }); } catch(e){}
		try { Canvas.updateAll(); } catch(e){}
	}

	// ===========================
	// Utils / Helpers (gerais)
	// ===========================
	function msgBox(title, text) {
		try {
			Blockbench.showMessageBox({ title, message: text, buttons: ["OK"] });
		} catch (e) {}
	}

	function markDirty() {
		try { Project.saved = false; } catch (e) {}
		try { Project.unsaved = true; } catch (e) {}
		try { if (Project.setSaved) Project.setSaved(false); } catch (e) {}
	}

	function getSelectedCubes() {
		if (typeof Cube !== "undefined" && Array.isArray(Cube.selected)) {
			return Cube.selected.filter(Boolean).slice();
		}
		if (Outliner && Array.isArray(Outliner.selected)) {
			return Outliner.selected.filter(o => o && o.type === "cube");
		}
		return [];
	}

	function centerOf(c) {
		return [
			(c.from[0] + c.to[0]) / 2,
			(c.from[1] + c.to[1]) / 2,
			(c.from[2] + c.to[2]) / 2,
		];
	}

	function sizeOf(c) {
		return [
			Math.abs(c.to[0] - c.from[0]),
			Math.abs(c.to[1] - c.from[1]),
			Math.abs(c.to[2] - c.from[2]),
		];
	}

	function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
	function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
	function rad2deg(r) { return r * 180 / Math.PI; }

	function setRotZDeg(cube, deg) {
		if (!cube.rotation) cube.rotation = [0, 0, 0];
		if (Array.isArray(cube.rotation)) {
			cube.rotation[0] = cube.rotation[0] || 0;
			cube.rotation[1] = cube.rotation[1] || 0;
			cube.rotation[2] = deg;
		} else if (typeof cube.rotation === "object") {
			cube.rotation.x = cube.rotation.x || 0;
			cube.rotation.y = cube.rotation.y || 0;
			cube.rotation.z = deg;
		}
	}

	function invRotZ(v, deg) {
		const a = (-deg) * Math.PI / 180;
		const c = Math.cos(a), s = Math.sin(a);
		const x = v[0] * c - v[1] * s;
		const y = v[0] * s + v[1] * c;
		return [x, y, v[2]];
	}
	
	// ===========================
	// Parte A: Rotação cubo -> Group (seu plugin principal)
	// ===========================
	function getGroupElementsAction() {
		return (
			BarItems?.group_elements ||
			BarItems?.group ||
			BarItems?.group_selected ||
			BarItems?.create_group ||
			null
		);
	}

	function getUnselectAction() {
		return (
			BarItems?.unselect_all ||
			BarItems?.unselect_all_elements ||
			BarItems?.select_none ||
			null
		);
	}

	function isGroup(obj) {
		return obj && (obj instanceof Group);
	}

	function safeSetVec3(dst, v) {
		if (Array.isArray(dst)) {
			dst[0] = v[0]; dst[1] = v[1]; dst[2] = v[2];
			return dst;
		}
		return v.slice();
	}

	function refreshSafe(elements) {
		try {
			Canvas.updateView({
				elements,
				element_aspects: { transform: true }
			});
		} catch (e) {}
		try { Outliner?.refresh?.(); } catch (e) {}
		try { Canvas.updateAll?.(); } catch (e) {}
	}

	function hardClearSelection() {
		const un = getUnselectAction();
		if (un && typeof un.click === "function") {
			try { un.click(); } catch (e) {}
		}
		try { Outliner.selected = []; } catch (e) {}
		try { Cube.selected = []; } catch (e) {}
	}

	function selectOnlyCube(cube) {
		hardClearSelection();
		try { cube.select(); } catch (e) {}
		try { Outliner.selected = [cube]; } catch (e) {}
	}

	const EPS = 1e-6;
	function isZeroRotation(rot) {
		rot = rot || [0, 0, 0];
		return (
			Math.abs(rot[0]) < EPS &&
			Math.abs(rot[1]) < EPS &&
			Math.abs(rot[2]) < EPS
		);
	}

	function showProgress(percent, extra) {
		const msg = extra ? `${percent}% — ${extra}` : `${percent}%`;
		if (typeof Blockbench.showQuickMessage === "function") {
			try { Blockbench.showQuickMessage(msg, 800); } catch (e) {}
		} else {
			try { console.log("[Extra Tools] Progresso:", msg); } catch (e) {}
		}
	}

	function groupAndTransferOneCube(cube) {
		return new Promise((resolve, reject) => {
			const groupAction = getGroupElementsAction();
			if (!groupAction || typeof groupAction.click !== "function") {
				reject(new Error("Não encontrei o comando nativo Group Elements."));
				return;
			}

			const oldParent = cube.parent;
			const oldRot = (cube.rotation || [0, 0, 0]).slice();
			const oldOrigin = (cube.origin || [0, 0, 0]).slice();

			if (isZeroRotation(oldRot)) {
				resolve({ skipped: true });
				return;
			}

			selectOnlyCube(cube);

			try {
				groupAction.click();
			} catch (e) {
				reject(new Error("Falha ao executar Group Elements nativo: " + (e?.message || e)));
				return;
			}

			let tries = 0;
			const maxTries = 80;
			const delay = 25;

			const poll = () => {
				tries++;

				const p = cube.parent;
				const group =
					(p && p !== oldParent && isGroup(p)) ? p :
					(Outliner.selected || []).find(isGroup) ||
					(isGroup(cube.parent) ? cube.parent : null);

				if (group && isGroup(group)) {
					try {
						Undo.initEdit({ elements: [cube], outliner: true });

						group.origin = safeSetVec3(group.origin, oldOrigin);
						group.rotation = safeSetVec3(group.rotation, oldRot);

						cube.rotation = [0, 0, 0];

						Undo.finishEdit("Rotação cubo → grupo (nativo)");

						refreshSafe([cube]);
						resolve({ skipped: false });
						return;
					} catch (err) {
						try { Undo?.cancelEdit?.(); } catch (e) {}
						reject(err);
						return;
					}
				}

				if (tries < maxTries) {
					setTimeout(poll, delay);
				} else {
					reject(new Error("Timeout: não consegui detectar o grupo criado para " + cube.name));
				}
			};

			poll();
		});
	}

	// ===========================
	// Excluir grupos vazios
	// ===========================
	function groupChildren(g) {
		return (g && Array.isArray(g.children)) ? g.children : [];
	}

	function isGroupEmpty(g) {
		return groupChildren(g).length === 0;
	}

	function removeGroupSafe(g) {
		try {
			if (typeof g.remove === "function") return g.remove();
			if (typeof g.delete === "function") return g.delete();
			if (typeof g.removeFromParent === "function") return g.removeFromParent();
		} catch (e) {}
	}

	function depthOfGroup(g) {
		let d = 0;
		let p = g?.parent;
		while (p && (p instanceof Group)) { d++; p = p.parent; }
		return d;
	}

	function collectGroupsPostOrder(rootGroup, out) {
		const ch = groupChildren(rootGroup);
		for (const node of ch) {
			if (node && (node instanceof Group)) {
				collectGroupsPostOrder(node, out);
			}
		}
		out.push(rootGroup);
	}

	function collectAllGroupsPostOrder() {
		const list = [];

		const roots =
			(Outliner?.root && Array.isArray(Outliner.root)) ? Outliner.root :
			(Project?.groups && Array.isArray(Project.groups)) ? Project.groups :
			(Array.isArray(Group?.all)) ? Group.all.filter(g => !g.parent) :
			[];

		for (const r of roots) {
			if (r && (r instanceof Group)) collectGroupsPostOrder(r, list);
		}

		if (list.length === 0 && Array.isArray(Group?.all)) {
			const all = Group.all.slice();
			all.sort((a, b) => depthOfGroup(b) - depthOfGroup(a));
			return all;
		}

		return list;
	}

	function deleteEmptyGroupsWithProgress() {
		const groups = collectAllGroupsPostOrder();

		if (!groups || groups.length === 0) {
			Blockbench.showQuickMessage?.("Nenhuma pasta (Group) encontrada.", 1400);
			return;
		}

		let removed = 0;
		const total = groups.length;

		let undoStarted = false;
		try {
			Undo.initEdit({ outliner: true });
			undoStarted = true;
		} catch (e) {}

		for (let i = 0; i < total; i++) {
			const g = groups[i];

			const percent = Math.floor((i / total) * 100);
			showProgress(percent, `Verificando pastas ${i + 1}/${total}`);

			if (g && (g instanceof Group) && isGroupEmpty(g)) {
				removeGroupSafe(g);
				removed++;
			}
		}

		if (undoStarted) {
			try { Undo.finishEdit("Excluir pastas vazias"); } catch (e) {}
		}

		refreshSafe([]);
		showProgress(100, `Concluído — removidas: ${removed}`);
		Blockbench.showQuickMessage?.(
			`Concluído: ${removed} pasta(s) vazia(s) removida(s).`,
			2000
		);
	}

	// ===========================
	// Parte B: Suite do test.js (Merge/Arc)
	// ===========================
	const ARC_OVERLAP_DEFAULT = 0.05;
	const ARC_INCLUDE_ENDPOINTS_DEFAULT = true;
	const ARC_MAX_CUBES_DEFAULT = 800;
	const ANGLE_EPS = 1e-3;

	function mergeBBoxStable() {
		const cubes = getSelectedCubes();
		if (cubes.length < 2) return msgBox("Kazim Tools", "Selecione pelo menos 2 Cubes.");

		const base = cubes[0];
		const others = cubes.slice(1);

		const min = [Infinity, Infinity, Infinity];
		const max = [-Infinity, -Infinity, -Infinity];

		cubes.forEach(c => {
			for (let i = 0; i < 3; i++) {
				const a = Number(c.from[i]);
				const b = Number(c.to[i]);
				const lo = Math.min(a, b);
				const hi = Math.max(a, b);
				if (lo < min[i]) min[i] = lo;
				if (hi > max[i]) max[i] = hi;
			}
		});

		for (let i = 0; i < 3; i++) if (max[i] === min[i]) max[i] = min[i] + 0.001;

		Undo.initEdit({ elements: cubes, outliner: true });

		base.from[0] = min[0]; base.from[1] = min[1]; base.from[2] = min[2];
		base.to[0]	 = max[0]; base.to[1]	 = max[1]; base.to[2]	 = max[2];
		base.name = "Merged Cube";

		others.forEach(c => c.remove());

		Undo.finishEdit("Merge Cubes (BBox) [Stable]");
		markDirty();

		try { base.select(); } catch (e) {}
		try { Canvas.updateAll(); } catch (e) {}
	}

	function mergeOBBByFirstLastStable() {
		const cubes = getSelectedCubes();
		if (cubes.length < 2) return msgBox("Kazim Tools", "Selecione pelo menos 2 Cubes.");

		const base = cubes[0];
		const last = cubes[cubes.length - 1];
		const others = cubes.slice(1);

		const o0 = centerOf(base);
		const o1 = centerOf(last);

		const dx = o1[0] - o0[0];
		const dy = o1[1] - o0[1];
		if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
			return msgBox("Kazim Tools", "First e Last estão no mesmo ponto. Selecione outro Last.");
		}

		const angleDeg = rad2deg(Math.atan2(dy, dx));
		const baseOrigin = o0;

		const minL = [Infinity, Infinity, Infinity];
		const maxL = [-Infinity, -Infinity, -Infinity];

		cubes.forEach(cube => {
			const f = cube.from, t = cube.to;
			const corners = [
				[f[0], f[1], f[2]], [f[0], f[1], t[2]], [f[0], t[1], f[2]], [f[0], t[1], t[2]],
				[t[0], f[1], f[2]], [t[0], f[1], t[2]], [t[0], t[1], f[2]], [t[0], t[1], t[2]],
			];

			corners.forEach(pW => {
				const rel = sub(pW, baseOrigin);
				const localRel = invRotZ(rel, angleDeg);
				const pL = add(localRel, baseOrigin);

				for (let i = 0; i < 3; i++) {
					if (pL[i] < minL[i]) minL[i] = pL[i];
					if (pL[i] > maxL[i]) maxL[i] = pL[i];
				}
			});
		});

		for (let i = 0; i < 3; i++) if (maxL[i] === minL[i]) maxL[i] = minL[i] + 0.001;

		Undo.initEdit({ elements: cubes, outliner: true });

		setRotZDeg(base, angleDeg);

		base.from[0] = minL[0]; base.from[1] = minL[1]; base.from[2] = minL[2];
		base.to[0]	 = maxL[0]; base.to[1]	 = maxL[1]; base.to[2]	 = maxL[2];
		base.name = "Merged Cube";

		others.forEach(c => c.remove());

		Undo.finishEdit("Merge Cubes (OBB by First/Last) [Stable]");
		markDirty();

		try { base.select(); } catch (e) {}
		try { Canvas.updateAll(); } catch (e) {}
	}

	function normAngle(a) {
		const two = Math.PI * 2;
		a = a % two;
		if (a < 0) a += two;
		return a;
	}
	function ccwDist(a, b) {
		const two = Math.PI * 2;
		return (b - a + two) % two;
	}
	
	// ===========================
	// Circuncentro por 3 pontos (2D)
	// ===========================
	function circumcenter(p1, p2, p3) {
		const x1 = p1[0], y1 = p1[1];
		const x2 = p2[0], y2 = p2[1];
		const x3 = p3[0], y3 = p3[1];

		const d = 2 * (x1*(y2 - y3) + x2*(y3 - y1) + x3*(y1 - y2));
		if (Math.abs(d) < 1e-9) return null;

		const s1 = x1*x1 + y1*y1;
		const s2 = x2*x2 + y2*y2;
		const s3 = x3*x3 + y3*y3;

		const ux = (s1*(y2 - y3) + s2*(y3 - y1) + s3*(y1 - y2)) / d;
		const uy = (s1*(x3 - x2) + s2*(x1 - x3) + s3*(x2 - x1)) / d;

		return [ux, uy];
	}

	function createArcCubesFillGaps() {
		const sel = getSelectedCubes();
		if (sel.length < 3) {
			return msgBox(
				"Kazim Tools",
				"Selecione 3 Cubes na ordem:\n1) Start\n2) Mid (define a curva)\n3) End\n\nDica: Shift+Click na ordem."
			);
		}

		const start = sel[0];
		const mid = sel[1];
		const end = sel[2];

		const cs = centerOf(start);
		const cm = centerOf(mid);
		const ce = centerOf(end);

		const c2 = circumcenter(cs, cm, ce);
		if (!c2) return msgBox("Kazim Tools", "Os 3 pontos parecem alinhados. Mova o Mid para criar curvatura.");

		const cx = c2[0], cy = c2[1];

		const rs = Math.hypot(cs[0] - cx, cs[1] - cy);
		const rm = Math.hypot(cm[0] - cx, cm[1] - cy);
		const re = Math.hypot(ce[0] - cx, ce[1] - cy);
		const r = (rs + rm + re) / 3;

		if (!isFinite(r) || r < 1e-6) return msgBox("Kazim Tools", "Raio inválido. Ajuste os cubos.");

		const aS = normAngle(Math.atan2(cs[1] - cy, cs[0] - cx));
		const aM = normAngle(Math.atan2(cm[1] - cy, cm[0] - cx));
		const aE = normAngle(Math.atan2(ce[1] - cy, ce[0] - cx));

		const distSM = ccwDist(aS, aM);
		const distSE = ccwDist(aS, aE);
		const useCCW = distSM <= distSE;
		const total = useCCW ? distSE : -ccwDist(aE, aS);

		const baseSize = sizeOf(start);

		const step = Math.max(0.001, baseSize[0] * (1 - ARC_OVERLAP_DEFAULT));
		const arcLen = Math.abs(total) * r;
		let segments = Math.ceil(arcLen / step) + 1;

		segments = Math.max(4, Math.min(segments, ARC_MAX_CUBES_DEFAULT));
		if (segments < 8 && arcLen > 0.001) segments = Math.min(ARC_MAX_CUBES_DEFAULT, 8);

		const parent = start.parent;

		// ✅ NATIVO: o Undo precisa receber o array que será preenchido com os novos elementos
		const _created = [];

		Undo.initEdit({
			outliner: true,
			elements: _created,
			selection: true
		});

		const iStart = ARC_INCLUDE_ENDPOINTS_DEFAULT ? 0 : 1;
		const iEnd = ARC_INCLUDE_ENDPOINTS_DEFAULT ? (segments - 1) : (segments - 2);

		for (let i = iStart; i <= iEnd; i++) {
			const t = i / (segments - 1);
			const a = aS + total * t;

			const px = cx + Math.cos(a) * r;
			const py = cy + Math.sin(a) * r;
			const pz = cs[2];

			const tangent = a + (useCCW ? Math.PI / 2 : -Math.PI / 2);
			const rotZ = rad2deg(tangent);

			const sx = baseSize[0], sy = baseSize[1], sz = baseSize[2];

			const cube = new Cube({
				name: "Arc Cube",
				from: [px - sx/2, py - sy/2, pz - sz/2],
				to:	 [px + sx/2, py + sy/2, pz + sz/2],
				origin: [px, py, pz],
				rotation: [0, 0, rotZ],
			});

			cube.addTo(parent);
			cube.init();

			// ✅ muito importante: registrar que esse cube foi criado nessa edição
			_created.push(cube);
		}

		try {
			Canvas.updateView({
				outliner: true,
				selection: true,
				elements: _created,
				element_aspects: { geometry: true }
			});
		} catch (e) {}

		Undo.finishEdit("Create Arc Cubes (Start/Mid/End) [Fill Gaps]");
		markDirty();

		try { Canvas.updateAll(); } catch (e) {}
	}

	// ===========================
	// 
	// ===========================
	function fillArcGapsSelectedArcCubes() {
		const sel = getSelectedCubes();
		if (sel.length < 2) {
			return msgBox("Kazim Tools", "Selecione pelo menos 2 cubos (Start e End). Para arco, recomendo 3+.");
		}

		const dialog = new Dialog({
			id: "a_preview_fill_arc_gaps_selected_action_dialogue",
			title: "Kazim Tools",
			form: {
				mode: {
					label: "Modo",
					type: "select",
					options: {
						between: "Between First & Last (como Vertex Snap)",
						circle: "Complete Circle (completa o círculo inteiro)",
						spiral: "Espiral (raio e altura variam)"
					},
					value: "between"
				},
				include_endpoints: { label: "Incluir endpoints", type: "checkbox", value: true },
				overlap: { label: "Overlap (0.00 a 0.30)", type: "number", value: ARC_OVERLAP_DEFAULT, min: 0, max: 0.3, step: 0.01 },
				max_cubes: { label: "Máximo de cubos criados", type: "number", value: ARC_MAX_CUBES_DEFAULT, min: 1, max: 5000, step: 1 },
				adaptive_size: { label: "Tamanho adaptativo (usa cubo mais próximo)", type: "checkbox", value: true },
				spiral_turns: { label: "Espiral: voltas extra (0.0 a 10.0)", type: "number", value: 1, min: 0, max: 10, step: 0.25 },
				spiral_ccw: { label: "Espiral: sentido CCW (desmarque = CW)", type: "checkbox", value: true },
				spiral_use_z: { label: "Espiral: interpolar altura (Z) do Start ao End", type: "checkbox", value: true }
			},
			buttons: ["OK", "Cancelar"],
			onConfirm(data) {
				dialog.hide();

				const MODE = data.mode;
				const INCLUDE = !!data.include_endpoints;
				const OVERLAP = Math.min(0.3, Math.max(0, Number(data.overlap) || 0));
				const MAXC = Math.max(1, Math.floor(Number(data.max_cubes) || ARC_MAX_CUBES_DEFAULT));
				const ADAPT = !!data.adaptive_size;
				const SP_TURNS = Math.min(10, Math.max(0, Number(data.spiral_turns) || 0));
				const SP_CCW = !!data.spiral_ccw;
				const SP_USE_Z = !!data.spiral_use_z;

				const pts = sel.map(c => centerOf(c));

				let c2 = null;
				if (pts.length >= 3) {
					for (let i = 0; i < pts.length && !c2; i++) {
						for (let j = i + 1; j < pts.length && !c2; j++) {
							for (let k = j + 1; k < pts.length && !c2; k++) {
								c2 = circumcenter(pts[i], pts[j], pts[k]);
							}
						}
					}
				}

				const base = sel[0];
				const parent = base.parent;

				const sizes = sel.map(c => sizeOf(c));
				const minSize = [
					Math.min(...sizes.map(s => s[0])),
					Math.min(...sizes.map(s => s[1])),
					Math.min(...sizes.map(s => s[2])),
				];

				const stepLen = Math.max(0.001, minSize[0] * (1 - OVERLAP));

				const samples = sel.map((c, i) => {
					const p = pts[i];
					const a = c2 ? normAngle(Math.atan2(p[1] - c2[1], p[0] - c2[0])) : 0;
					return { a, size: sizes[i] };
				});

				function nearestSize(angle) {
					if (!samples.length) return minSize;
					let best = samples[0].size;
					let bestDa = Infinity;
					for (const s of samples) {
						const da = Math.min(ccwDist(angle, s.a), ccwDist(s.a, angle));
						if (da < bestDa) { bestDa = da; best = s.size; }
					}
					return best || minSize;
				}

				function spawn(createdArr, px, py, pz, rotZdeg, angle) {
					const sz3 = (ADAPT && typeof angle === "number") ? nearestSize(angle) : minSize;
					const sx = sz3[0], sy = sz3[1], sz = sz3[2];

					const cube = new Cube({
						name: "Gap Cube",
						from: [px - sx/2, py - sy/2, pz - sz/2],
						to:	 [px + sx/2, py + sy/2, pz + sz/2],
						origin: [px, py, pz],
						rotation: [0, 0, rotZdeg],
					});

					cube.addTo(parent);
					cube.init();

					// ✅ registra que esse cube nasceu nesta edição
					createdArr.push(cube);
				}

				// Fallback linha (sem círculo detectável)
				if (!c2) {
					const a = centerOf(sel[0]);
					const b = centerOf(sel[sel.length - 1]);

					const dx = b[0] - a[0];
					const dy = b[1] - a[1];
					const dist = Math.hypot(dx, dy);

					if (!isFinite(dist) || dist < 1e-6) {
						return msgBox("Kazim Tools", "Start e End estão no mesmo ponto (ou muito perto).");
					}

					const segments = Math.min(MAXC, Math.max(2, Math.ceil(dist / stepLen) + 1));
					const rotZ = rad2deg(Math.atan2(dy, dx));
					const pz = a[2];
					let created = 0;

					const _created2 = [];

					Undo.initEdit({
						outliner: true,
						elements: _created2,
						selection: true
					});

					const iStart = INCLUDE ? 0 : 1;
					const iEnd = INCLUDE ? segments - 1 : segments - 2;

					for (let i = iStart; i <= iEnd; i++) {
						const t = i / (segments - 1);
						const px = a[0] + dx * t;
						const py = a[1] + dy * t;
						spawn(_created2, px, py, pz, rotZ);
						created++;
						if (created >= MAXC) break;
					}

					Undo.finishEdit("Fill Align (Selected Cubes) [Line]");
					markDirty();
					try { Canvas.updateAll(); } catch (e) {}
					return msgBox("Kazim Tools", `Fill Align (Line): criei ${created} cubo(s).`);
				}

				// Arco/círculo
				const cx = c2[0], cy = c2[1];
				const radii = pts.map(p => Math.hypot(p[0] - cx, p[1] - cy));
				const r = radii.reduce((s, v) => s + v, 0) / radii.length;

				if (!isFinite(r) || r < 1e-6) return msgBox("Kazim Tools", "Raio inválido ao detectar círculo.");

				const stepAng = stepLen / r;

				const existingAngles = pts.map(p => normAngle(Math.atan2(p[1] - cy, p[0] - cx)));

				function angleNearExisting(a) {
					for (let i = 0; i < existingAngles.length; i++) {
						const da = Math.min(ccwDist(a, existingAngles[i]), ccwDist(existingAngles[i], a));
						if (da < ANGLE_EPS) return true;
					}
					return false;
				}

				const pStart = centerOf(sel[0]);
				const pEnd = centerOf(sel[sel.length - 1]);
				const aStart = normAngle(Math.atan2(pStart[1] - cy, pStart[0] - cx));
				const aEnd	 = normAngle(Math.atan2(pEnd[1] - cy, pEnd[0] - cx));

				function countInsideArcCCW(a0, a1) {
					const span = ccwDist(a0, a1);
					let c = 0;
					for (const a of existingAngles) {
						const d = ccwDist(a0, a);
						if (d >= 0 && d <= span + 1e-9) c++;
					}
					return c;
				}

				const spanCCW = ccwDist(aStart, aEnd);
				const spanCW	= ccwDist(aEnd, aStart);
				const insideCCW = countInsideArcCCW(aStart, aEnd);
				const insideCW	= countInsideArcCCW(aEnd, aStart);

				let useCCW = insideCCW >= insideCW;
				if (MODE === "circle") useCCW = true;

				const pz = pStart[2];
				let created = 0;

				// ✅ NATIVO: registrar os criados no array passado ao initEdit
				const _created3 = [];

				Undo.initEdit({
					outliner: true,
					elements: _created3,
					selection: true
				});

				if (MODE === "spiral") {
					const z0 = pStart[2];
					const z1 = pEnd[2];
					const r0 = Math.hypot(pStart[0] - cx, pStart[1] - cy);
					const r1 = Math.hypot(pEnd[0] - cx, pEnd[1] - cy);

					const dir = SP_CCW ? 1 : -1;
					const baseSpan = SP_CCW ? ccwDist(aStart, aEnd) : (-ccwDist(aEnd, aStart));
					const totalSpan = baseSpan + dir * (Math.PI * 2) * SP_TURNS;

					const S = 32;
					let len = 0;
					let pxPrev = null, pyPrev = null, pzPrev = null;
					for (let i = 0; i <= S; i++) {
						const t = i / S;
						const a = aStart + totalSpan * t;
						const rr = r0 + (r1 - r0) * t;
						const px = cx + Math.cos(a) * rr;
						const py = cy + Math.sin(a) * rr;
						const pzS = SP_USE_Z ? (z0 + (z1 - z0) * t) : pz;
						if (pxPrev !== null) {
							const dx = px - pxPrev, dy = py - pyPrev, dz = pzS - pzPrev;
							len += Math.hypot(dx, dy, dz);
						}
						pxPrev = px; pyPrev = py; pzPrev = pzS;
					}

					const segments = Math.min(MAXC, Math.max(2, Math.ceil(len / stepLen) + 1));
					const iStart = INCLUDE ? 0 : 1;
					const iEnd = INCLUDE ? segments - 1 : segments - 2;

					for (let i = iStart; i <= iEnd; i++) {
						const t = i / (segments - 1);
						const a = aStart + totalSpan * t;
						const rr = r0 + (r1 - r0) * t;
						const px = cx + Math.cos(a) * rr;
						const py = cy + Math.sin(a) * rr;
						const pzS = SP_USE_Z ? (z0 + (z1 - z0) * t) : pz;

						const tangent = a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
						spawn(_created3, px, py, pzS, rad2deg(tangent), normAngle(a));

						created++;
						if (created >= MAXC) break;
					}

					Undo.finishEdit("Fill Arc Gaps (Selected Arc Cubes) [Spiral]");
					markDirty();
					try { Canvas.updateAll(); } catch (e) {}
					return msgBox("Kazim Tools", `Espiral: criei ${created} cubo(s).`);
				}

				if (MODE === "circle") {
					const segments = Math.min(MAXC, Math.max(8, Math.ceil((Math.PI * 2) / stepAng) + 1));
					const iStart = INCLUDE ? 0 : 1;
					const iEnd = INCLUDE ? segments - 1 : segments - 2;

					for (let i = iStart; i <= iEnd; i++) {
						const t = i / (segments - 1);
						const a = normAngle(aStart + (Math.PI * 2) * t);

						if (angleNearExisting(a)) continue;

						const px = cx + Math.cos(a) * r;
						const py = cy + Math.sin(a) * r;

						const tangent = a + Math.PI / 2;
						spawn(_created3, px, py, pz, rad2deg(tangent), a);

						existingAngles.push(a);
						created++;
						if (created >= MAXC) break;
					}

					Undo.finishEdit("Fill Arc Gaps (Selected Arc Cubes) [Complete Circle]");
					markDirty();
					try { Canvas.updateAll(); } catch (e) {}
					return msgBox("Kazim Tools", `Complete Circle: criei ${created} cubo(s).`);
				}

				// between
				let span = useCCW ? spanCCW : spanCW;
				if (span < 1e-9) span = Math.PI * 2;

				const segments = Math.min(MAXC, Math.max(2, Math.ceil(span / stepAng) + 1));
				const iStart = INCLUDE ? 0 : 1;
				const iEnd = INCLUDE ? segments - 1 : segments - 2;

				for (let i = iStart; i <= iEnd; i++) {
					const t = i / (segments - 1);

					let a;
					if (useCCW) a = normAngle(aStart + span * t);
					else a = normAngle(aStart - span * t);

					if (angleNearExisting(a)) continue;

					const px = cx + Math.cos(a) * r;
					const py = cy + Math.sin(a) * r;

					const tangent = a + (useCCW ? Math.PI / 2 : -Math.PI / 2);
					spawn(_created3, px, py, pz, rad2deg(tangent), a);

					existingAngles.push(a);
					created++;
					if (created >= MAXC) break;
				}

				Undo.finishEdit("Fill Arc Gaps (Selected Arc Cubes) [Between First & Last]");
				markDirty();
				try { Canvas.updateAll(); } catch (e) {}
				return msgBox("Kazim Tools", `Between First & Last: criei ${created} cubo(s). (Direção: ${useCCW ? "CCW" : "CW"})`);
			}
		});

		dialog.show();
	}

	// ===========================
	// Plugin.register (único)
	// ===========================
	
	const KazimIcons = {
		manifest: "extensions_tools_manifest.png",
		to_cube: "icons/to_cube.png",
		to_mesh: "icons/to_mesh.png"
	}
	
	Plugin.register(PLUGIN_ID, {
		title: "Extensões Custom",
		icon: KazimIcons.manifest,        // ícone do plugin
		author: "Kazimuhwari",
		description: "Ferramentas para faciliar ás mãos de obra. :3",
		version: "2.0.0",
		min_version: "4.8.0",
		variant: "both",                  // model + animation
		tags: ["Tools", "Mesh", "Utility", "Minecraft"],
		creation_date: "2026-03-16",
		has_changelog: true,
		bug_tracker: "https://discord.gg/qwRtDUpYJt",

		onload() {

			/*const a_creater_test = new Action("a_creater_test", {
				name: "Teste",
				icon: "language",
				click() {
					openAutoUVAtlasDialog();
				}
			});*/

// -----------------
			const a_creater_uv_altas_mesh = new Action("a_creater_uv_altas_mesh", {
				name: "🏁┇ UV Altas Mesh",
				icon: "auto_fix_high",
				click() {
					openAutoUVAtlasDialog();
				}
			});

			const a_generate_optimize_mesh = new Action("a_generate_optimize_mesh", {
				name: "🏁┇ Optimize Mesh",
				description: "Reduza a contagem de faces da malha e transfira as coordenadas UV originais para a malha otimizada.",
				icon: "auto_fix_high",
				click() {
					openOptimizeMeshDialog();
				}
			});

			const a_preview_organic_capsule_surface = new Action("a_preview_organic_capsule_surface", {
				name: "🔶┇ Organic Capsule Surface From Cubes",
				description: "Transforma cada cubo selecionado em esfera/elipsoide ou cápsula com tampas arredondadas usando geração por anéis.",
				icon: "language",
				click() {
					openOrganicCapsuleSurfaceDialog();
				}
			});

			const a_preview_organic_sphere_fusion = new Action("a_preview_organic_sphere_fusion", {
				name: "🔶┇ Fusion of Organic Spheres",
				description: "Cada cubo vira sua própria esfera/elipsoide e todas se fundem em uma massa orgânica.",
				icon: "blur_on",
				click() {
					openOrganicSphereFusionDialog();
				}
			});

			const a_generate_filled_sphere_surface = new Action("a_generate_filled_sphere_surface", {
				name: "🏁┇ Generate a filled spherical surface for cubes",
				description: "Usa cubos selecionados como esqueleto e gera uma esfera/elipsoide com opções de densidade.",
				icon: "language",
				click() {
					openFilledSphereSurfaceDialog();
				}
			});

			const a_preview_sphere_fill = new Action("a_preview_sphere_fill", {
				name: "🔶┇ 3D spherical grid fill",
				icon: "fa-globe",
				click() {
					fillSphereFromSelection();
				}
			});

			const a_preview_arc_touch = new Action("a_preview_arc_touch", {
				name: "🔶┇ Create an arc around the cube using Tap + Fill \"1 Cube\"",
				description: "Cria arco perfeito encostando no cubo selecionado e preenche todos os espaços.",
				icon: "fa-circle",
				click() {
					createArcTouchingCube();
				}
			});

			const a_test_hair_strand = new Action("a_test_hair_strand", {
				name: "🚧┇ Generate a hair strand",
				icon: "call_split",
				click() {
					generateHairStrand();
				}
			});

			const a_test_radial_hair = new Action("a_test_radial_hair", {
				name: "🚧┇ Generate a radical hair",
				icon: "rotate_right",
				click() {
					radialHair();
				}
			});

			const a_test_hair_curve = new Action("a_test_hair_curve", {
				name: "🚧┇ Generate a hair curve",
				icon: "gesture",
				click() {
					hairCurve();
				}
			});

			const a_generate_inflate_keep = new Action("a_generate_inflate_keep", {
				name: "🏁┇ Fill the cube until it returns to its original size. (Bedrock)",
				description: "Corrige cubos menores que 1 mantendo posição e inflate.",
				icon: "open_with",
				click() {
					bedrockInflateFix();
				}
			});

			// ---- Actions antigas (Edit) ----
			const a_generate_action_single = new Action("a_generate_action_single", {
				name: "🏁┇ Rotate the cube to the new group \"1 Cube\" (Bedrock)",
				description: "Seleciona 1 cubo: agrupa (nativo) e transfere rotação para o grupo (se não for 0,0,0).",
				icon: "folder",
				category: "edit",
				condition() { return Cube.selected && Cube.selected.length === 1; },
				click() {
					const cube = Cube.selected?.[0];
					if (!cube) return;

					const rot = (cube.rotation || [0, 0, 0]).slice();
					if (isZeroRotation(rot)) {
						Blockbench.showQuickMessage?.("Ignorado: rotação já é 0,0,0.", 1200);
						return;
					}

					showProgress(0, "Iniciando...");
					groupAndTransferOneCube(cube).then((res) => {
						if (res?.skipped) {
							Blockbench.showQuickMessage?.("Ignorado: rotação já era 0,0,0.", 1200);
							return;
						}
						showProgress(100, "Concluído (1/1)");
					}).catch(err => {
						console.error("[Extra Tools] single:", err);
						Blockbench.showMessageBox({
							title: "Extensões Extras",
							message: `Erro: ${err?.message || err}`
						});
					});
				}
			});

			const a_generate_action_all = new Action("a_generate_action_all", {
				name: "🏁┇ Rotate the cube to the new \"All Cubes\" group. (Bedrock)",
				description: "Para cada cubo selecionado: agrupa (nativo) e transfere rotação. Pula os que já são 0,0,0. Mostra %.",
				icon: "folder",
				category: "edit",
				condition() { return Cube.selected && Cube.selected.length >= 2; },
				click() {
					const original = (Cube.selected || []).slice();
					const cubes = original.filter(c => !isZeroRotation((c.rotation || [0, 0, 0])));

					if (cubes.length === 0) {
						Blockbench.showQuickMessage?.("Nada a fazer: todas as rotações já são 0,0,0.", 1600);
						return;
					}

					let i = 0;
					const total = cubes.length;

					const next = () => {
						if (i >= total) {
							showProgress(100, `Concluído (${total}/${total})`);
							Blockbench.showQuickMessage?.("Concluído: todos processados (nativo).", 1400);
							refreshSafe(original);
							return;
						}

						const cube = cubes[i];
						const percent = Math.floor((i / total) * 100);
						showProgress(percent, `Aplicando ${i + 1}/${total}`);

						groupAndTransferOneCube(cube)
							.then(() => { i++; setTimeout(next, 0); })
							.catch(err => { console.error("[Extra Tools] multi:", err); i++; setTimeout(next, 0); });
					};

					showProgress(0, `Preparando (${total} itens)`);
					next();
				}
			});

			const a_generate_action_delete_empty = new Action("a_generate_action_delete_empty", {
				name: "🏁┇ Delete empty groups",
				description: "Verifica e exclui apenas as pastas realmente vazias no Outliner (de baixo pra cima).",
				icon: "delete",
				category: "edit",
				condition() { return true; },
				click() { deleteEmptyGroupsWithProgress(); }
			});

			// ---- Actions do test.js (no submenu Tools) ----
			const a_preview_bbox = new Action("a_preview_bbox", {
				name: "🔶┇ Merge cubes BBox Stable",
				description: "Engloba no eixo do mundo (BBox), reaproveitando o primeiro cube",
				icon: "fa-cube",
				click() { mergeBBoxStable(); }
			});

			const a_preview_obb_first_last = new Action("a_preview_obb_first_last", {
				name: "🔶┇ Merge OBB cubes by first/last stable",
				description: "Auto-rotaciona Z pelo vetor do primeiro para o último e engloba (remove os outros)",
				icon: "fa-cube",
				click() { mergeOBBByFirstLastStable(); }
			});

			const a_preview_create_arc_cubes_action = new Action("a_preview_create_arc_cubes_action", {
				name: "🔶┇ Create arc cubes: Start/Middle/End, Fill in the gaps",
				description: "Cria cubos ao longo do arco com passo por comprimento do arco + endpoints. Selecione Start/Mid/End na ordem.",
				icon: "fa-share-alt",
				click() { createArcCubesFillGaps(); }
			});

			const a_preview_fill_arc_gaps_selected_action = new Action("a_preview_fill_arc_gaps_selected_action", {
				name: "🏁┇ Fill in the gaps in the arch. Selected arch cubes.",
				description: "Detecta o círculo pelos cubos selecionados e preenche gaps automaticamente (com modos).",
				icon: "fa-magic",
				click() { fillArcGapsSelectedArcCubes(); }
			});


			const CubeToolsMenu = {
				id: "to_cube_tools",
				name: "To Cube",
				icon: KazimIcons.to_cube,
				children: [
					a_generate_action_single,
					a_generate_action_all,
					a_generate_action_delete_empty,
					a_preview_create_arc_cubes_action,
					a_preview_obb_first_last,
					a_preview_fill_arc_gaps_selected_action,
					a_generate_inflate_keep,
					a_generate_filled_sphere_surface,
					a_preview_bbox,
					a_preview_arc_touch,
					a_preview_sphere_fill,
					a_preview_organic_sphere_fusion,
					a_preview_organic_capsule_surface,
					a_test_hair_strand,
					a_test_radial_hair,
					a_test_hair_curve
				]
			};

			const MeshToolsMenu = {
				id: "to_mesh_tools",
				name: "To Mesh",
				icon: KazimIcons.to_mesh,
				children: [
					a_generate_optimize_mesh,
					a_creater_uv_altas_mesh
				]
			};

			// Submenu: Tools → Kazim Tools
			const kazimToolsMenu = {
				id: "kazim_tools",
				name: "Kazim Tools",
				icon: KazimIcons.manifest,
				children: [
					CubeToolsMenu,
					MeshToolsMenu
				]
			};

			MenuBar.addAction(kazimToolsMenu, "tools");

			// guarda p/ unload
			this._actions = [
			// Done:
			a_generate_action_single, a_generate_action_all, a_generate_action_delete_empty, a_preview_create_arc_cubes_action, 
			a_preview_obb_first_last, a_preview_fill_arc_gaps_selected_action, a_generate_inflate_keep, a_generate_filled_sphere_surface, 
			a_generate_optimize_mesh, 
			// Preview:
			a_preview_bbox, a_preview_arc_touch, a_preview_sphere_fill, a_preview_organic_sphere_fusion, 
			a_preview_organic_capsule_surface, 
			// Test:
			a_test_hair_strand, a_test_radial_hair, a_test_hair_curve, 
			
			// Now:
			a_creater_test
			];
		},

		onunload() {
			(this._actions || []).forEach(a => a?.delete?.());
		}
	});
})();
