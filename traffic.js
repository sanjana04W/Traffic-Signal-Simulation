// --- Custom Data Structures ---

class Vehicle {
    constructor(id, type, direction, arrivalTime) {
        this.id = id;
        this.type = type;
        this.direction = direction;
        this.arrivalTime = arrivalTime;
        this.waitTime = 0;
    }
}

class Queue {
    constructor() { this.items = []; }
    enqueue(item) { this.items.push(item); }
    dequeue() { if (this.isEmpty()) return null; return this.items.shift(); }
    peek() { if (this.isEmpty()) return null; return this.items[0]; }
    isEmpty() { return this.items.length === 0; }
    size() { return this.items.length; }
    getVehiclesByType(type) { return this.items.filter(v => v.type === type); }
    getTotalWaitTime() { return this.items.reduce((sum, v) => sum + ((Date.now() - v.arrivalTime) / 1000), 0); }
}

class MaxHeap {
    constructor() { this.heap = []; }
    getParentIndex(i) { return Math.floor((i - 1) / 2); }
    getLeftChildIndex(i) { return 2 * i + 1; }
    getRightChildIndex(i) { return 2 * i + 2; }
    hasParent(i) { return this.getParentIndex(i) >= 0; }
    hasLeftChild(i) { return this.getLeftChildIndex(i) < this.heap.length; }
    hasRightChild(i) { return this.getRightChildIndex(i) < this.heap.length; }
    getParent(i) { return this.heap[this.getParentIndex(i)]; }
    getLeftChild(i) { return this.heap[this.getLeftChildIndex(i)]; }
    getRightChild(i) { return this.heap[this.getRightChildIndex(i)]; }
    swap(i1, i2) { [this.heap[i1], this.heap[i2]] = [this.heap[i2], this.heap[i1]]; }

    getPriorityScore(intersection) {
        return intersection.hasEmergencyVehicle ? 1000 + intersection.getTotalVehicles() : intersection.getTotalVehicles();
    }

    add(intersection) {
        this.heap.push(intersection);
        this.heapifyUp();
    }

    extractMax() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        const max = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.heapifyDown();
        return max;
    }

    heapifyUp(startIndex = this.heap.length - 1) {
        let index = startIndex;
        while (this.hasParent(index) && this.getPriorityScore(this.getParent(index)) < this.getPriorityScore(this.heap[index])) {
            this.swap(this.getParentIndex(index), index);
            index = this.getParentIndex(index);
        }
    }

    heapifyDown(startIndex = 0) {
        let index = startIndex;
        while (this.hasLeftChild(index)) {
            let largerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.getPriorityScore(this.getRightChild(index)) > this.getPriorityScore(this.getLeftChild(index))) {
                largerChildIndex = this.getRightChildIndex(index);
            }
            if (this.getPriorityScore(this.heap[index]) < this.getPriorityScore(this.heap[largerChildIndex])) {
                this.swap(index, largerChildIndex);
            } else {
                break;
            }
            index = largerChildIndex;
        }
    }

    isEmpty() { return this.heap.length === 0; }
    size() { return this.heap.length; }

    update(intersection) {
        this.remove(intersection.id);
        this.add(intersection);
    }

    remove(intersectionId) {
        const indexToRemove = this.heap.findIndex(item => item.id === intersectionId);
        if (indexToRemove === -1) return false;
        if (indexToRemove === this.heap.length - 1) {
            this.heap.pop();
        } else {
            this.heap[indexToRemove] = this.heap.pop();
            if (this.hasParent(indexToRemove) && this.getPriorityScore(this.heap[indexToRemove]) > this.getPriorityScore(this.getParent(indexToRemove))) {
                this.heapifyUp(indexToRemove);
            } else {
                this.heapifyDown(indexToRemove);
            }
        }
        return true;
    }
}

class Intersection {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.queues = { 'N': new Queue(), 'S': new Queue(), 'E': new Queue(), 'W': new Queue() };
        this.currentGreenLight = 'N';
        this.greenLightDuration = { 'N': 0, 'S': 0, 'E': 0, 'W': 0 };
        this.minGreenDuration = 5;
        this.maxGreenDuration = 30;
        this.emergencyGreenDuration = 25;
        this.congestionLevel = 0;
        this.hasEmergencyVehicle = false;
        this.emergencyVehicleInfo = null;
        this.totalVehiclesProcessed = 0;
    }

    addVehicle(vehicle) {
        this.queues[vehicle.direction].enqueue(vehicle);
        if (vehicle.type === 'emergency') {
            this.hasEmergencyVehicle = true;
            this.emergencyVehicleInfo = {
                type: vehicle.type,
                location: this.id,
                time: Date.now(),
                intendedDirection: vehicle.direction
            };
        }
        this.updateCongestion();
    }

    processVehicles(timeStep) {
        const currentQueue = this.queues[this.currentGreenLight];
        if (currentQueue.isEmpty()) return 0;
        const vehiclesCanMove = Math.min(
            currentQueue.size(),
            Math.floor(this.greenLightDuration[this.currentGreenLight] * (timeStep / 1000) * 2)
        );
        let vehiclesMoved = 0;
        for (let i = 0; i < vehiclesCanMove; i++) {
            const vehicle = currentQueue.dequeue();
            if (vehicle) {
                this.totalVehiclesProcessed++;
                vehicle.waitTime = (Date.now() - vehicle.arrivalTime) / 1000;
                vehiclesMoved++;
            } else break;
        }
        if (this.hasEmergencyVehicle && currentQueue.getVehiclesByType('emergency').length === 0) {
            this.hasEmergencyVehicle = false;
            this.emergencyVehicleInfo = null;
        }
        this.updateCongestion();
        return vehiclesMoved;
    }

    updateGreenLightDuration(emergencyOverride = false) {
        const directions = ['N', 'E', 'S', 'W'];
        let anyEmergencyInQueues = false;
        for (const dir of directions) {
            if (this.queues[dir].getVehiclesByType('emergency').length > 0) { anyEmergencyInQueues = true; break; }
        }
        this.hasEmergencyVehicle = anyEmergencyInQueues;
        if (!anyEmergencyInQueues) this.emergencyVehicleInfo = null;

        if (emergencyOverride && this.hasEmergencyVehicle) {
            for (const dir of directions) {
                if (this.queues[dir].getVehiclesByType('emergency').length > 0) {
                    this.currentGreenLight = dir;
                    this.greenLightDuration[dir] = this.emergencyGreenDuration;
                    directions.forEach(otherDir => { if (otherDir !== dir) this.greenLightDuration[otherDir] = 0; });
                    return;
                }
            }
        }

        let totalQueueLength = 0;
        let longestQueueDirection = this.currentGreenLight;
        let maxQueueLength = 0;
        directions.forEach(dir => {
            const qSize = this.queues[dir].size();
            totalQueueLength += qSize;
            if (qSize > maxQueueLength) { maxQueueLength = qSize; longestQueueDirection = dir; }
        });

        if (totalQueueLength === 0) {
            directions.forEach(dir => this.greenLightDuration[dir] = 0);
            const currentIndex = directions.indexOf(this.currentGreenLight);
            this.currentGreenLight = directions[(currentIndex + 1) % directions.length];
            this.greenLightDuration[this.currentGreenLight] = this.minGreenDuration;
            return;
        }

        const baseCycleDuration = 45;
        let allocatedSum = 0;
        directions.forEach(dir => {
            const queueSize = this.queues[dir].size();
            if (queueSize > 0) {
                let duration = Math.floor((queueSize / totalQueueLength) * baseCycleDuration);
                duration = Math.max(this.minGreenDuration, Math.min(this.maxGreenDuration, duration));
                this.greenLightDuration[dir] = duration;
            } else {
                this.greenLightDuration[dir] = 0;
            }
            allocatedSum += this.greenLightDuration[dir];
        });

        if (allocatedSum === 0 && totalQueueLength > 0) {
            this.greenLightDuration[longestQueueDirection] = this.minGreenDuration;
        } else if (allocatedSum < baseCycleDuration && totalQueueLength > 0) {
            this.greenLightDuration[longestQueueDirection] += (baseCycleDuration - allocatedSum);
        }

        if (this.greenLightDuration[this.currentGreenLight] <= 0 || this.queues[this.currentGreenLight].isEmpty()) {
            let nextDir = longestQueueDirection;
            if (nextDir === this.currentGreenLight && totalQueueLength > maxQueueLength) {
                const currentIndex = directions.indexOf(this.currentGreenLight);
                nextDir = directions[(currentIndex + 1) % directions.length];
            }
            this.currentGreenLight = nextDir;
        }
    }

    updateCongestion() {
        let totalWaitingVehicles = 0;
        let totalWaitTimeSum = 0;
        for (const dir in this.queues) {
            totalWaitingVehicles += this.queues[dir].size();
            totalWaitTimeSum += this.queues[dir].getTotalWaitTime();
        }
        const avgWaitTime = totalWaitingVehicles > 0 ? totalWaitTimeSum / totalWaitingVehicles : 0;
        this.congestionLevel = Math.min(100, Math.max(0, (totalWaitingVehicles * 5) + (avgWaitTime * 2)));
    }

    getTotalVehicles() {
        let count = 0;
        for (const dir in this.queues) count += this.queues[dir].size();
        return count;
    }

    getTrafficData() {
        const data = {
            id: this.id,
            congestion: this.congestionLevel.toFixed(1),
            greenLight: this.currentGreenLight,
            duration: this.greenLightDuration[this.currentGreenLight].toFixed(1),
            queues: {},
            totalVehiclesProcessed: this.totalVehiclesProcessed
        };
        for (const dir in this.queues) {
            const queue = this.queues[dir];
            data.queues[dir] = {
                size: queue.size(),
                regular: queue.getVehiclesByType('regular').length,
                publicTransport: queue.getVehiclesByType('public-transport').length,
                emergency: queue.getVehiclesByType('emergency').length,
                avgWaitTime: queue.size() > 0 ? (queue.getTotalWaitTime() / queue.size()).toFixed(1) : 0
            };
        }
        data.hasEmergency = this.hasEmergencyVehicle;
        data.emergencyInfo = this.emergencyVehicleInfo;
        return data;
    }
}

class TrafficNetwork {
    constructor() {
        this.intersections = new Map();
        this.adjList = new Map();
        this.nextVehicleId = 0;
    }

    addIntersection(intersection) {
        this.intersections.set(intersection.id, intersection);
        if (!this.adjList.has(intersection.id)) this.adjList.set(intersection.id, []);
    }

    addRoad(intersection1Id, intersection2Id, weight = 1) {
        if (this.intersections.has(intersection1Id) && this.intersections.has(intersection2Id)) {
            this.adjList.get(intersection1Id).push({ destId: intersection2Id, weight: weight });
            this.adjList.get(intersection2Id).push({ destId: intersection1Id, weight: weight });
        } else {
            console.warn(`Attempted to add road with non-existent intersections: ${intersection1Id}, ${intersection2Id}`);
        }
    }

    findShortestPath(startId, endId, avoidCongested = false) {
        if (!this.intersections.has(startId) || !this.intersections.has(endId)) {
            console.error("Start or end intersection not found for pathfinding.");
            return [];
        }

        const distances = new Map();
        const predecessors = new Map();
        const queue = new Queue();

        this.intersections.forEach(node => { distances.set(node.id, Infinity); predecessors.set(node.id, null); });

        distances.set(startId, 0);
        queue.enqueue(startId);

        while (!queue.isEmpty()) {
            const currentId = queue.dequeue();
            if (currentId === endId) break;
            const neighbors = this.adjList.get(currentId) || [];
            for (const neighbor of neighbors) {
                const neighborIntersection = this.intersections.get(neighbor.destId);
                const isCongested = avoidCongested && neighborIntersection.congestionLevel > 60;
                if (distances.get(neighbor.destId) === Infinity && !isCongested) {
                    distances.set(neighbor.destId, distances.get(currentId) + (neighbor.weight || 1));
                    predecessors.set(neighbor.destId, currentId);
                    queue.enqueue(neighbor.destId);
                }
            }
        }

        const path = [];
        let current = endId;
        while (current !== null) {
            path.unshift(current);
            current = predecessors.get(current);
            if (path[0] === undefined && current !== null) return [];
            if (path.length > this.intersections.size + 1) return [];
        }
        return path[0] === startId ? path : [];
    }

    generateRandomVehicle(forceType = null) {
        const intersectionIds = Array.from(this.intersections.keys());
        if (intersectionIds.length === 0) return;
        const randomStartIntersectionId = intersectionIds[Math.floor(Math.random() * intersectionIds.length)];
        const types = forceType ? [forceType] : ['regular','regular','regular','regular','public-transport','emergency'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const directions = ['N','S','E','W'];
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];
        const vehicle = new Vehicle(this.nextVehicleId++, randomType, randomDirection, Date.now());
        this.intersections.get(randomStartIntersectionId).addVehicle(vehicle);
        console.log(`Generated ${randomType} vehicle ${vehicle.id} at ${randomStartIntersectionId} going ${randomDirection}`);
    }
}

// --- Simulation Core ---
let trafficNetwork;
let emergencyHeap;
let simulationInterval;
const SIMULATION_SPEED = 500;

function initializeSimulation() {
    trafficNetwork = new TrafficNetwork();
    emergencyHeap = new MaxHeap();

    const intersections = [
        new Intersection('A', 100, 100),
        new Intersection('B', 300, 100),
        new Intersection('C', 100, 300),
        new Intersection('D', 300, 300),
        new Intersection('E', 500, 200)
    ];
    intersections.forEach(i => trafficNetwork.addIntersection(i));

    trafficNetwork.addRoad('A','B',1);
    trafficNetwork.addRoad('A','C',1);
    trafficNetwork.addRoad('B','D',1);
    trafficNetwork.addRoad('C','D',1);
    trafficNetwork.addRoad('B','E',1);
    trafficNetwork.addRoad('D','E',1);
    trafficNetwork.addRoad('A','E',2);

    renderSimulationArea();
    updateDashboard();
    populatePathModalSelectors();
}

function simulationTick() {
    trafficNetwork.generateRandomVehicle();

    trafficNetwork.intersections.forEach(intersection => {
        if (intersection.hasEmergencyVehicle || intersection.getTotalVehicles() > 0) {
            emergencyHeap.update(intersection);
        } else {
            emergencyHeap.remove(intersection.id);
        }
    });

    let emergencyProcessedThisTick = false;
    if (!emergencyHeap.isEmpty()) {
        const highPriorityIntersection = emergencyHeap.extractMax();
        if (highPriorityIntersection) {
            highPriorityIntersection.updateGreenLightDuration(true);
            highPriorityIntersection.processVehicles(SIMULATION_SPEED);
            if (highPriorityIntersection.hasEmergencyVehicle || highPriorityIntersection.getTotalVehicles() > 0) {
                emergencyHeap.add(highPriorityIntersection);
            }
            emergencyProcessedThisTick = true;
        }
    }

    trafficNetwork.intersections.forEach(intersection => {
        if (!emergencyProcessedThisTick || !intersection.hasEmergencyVehicle) {
            intersection.updateGreenLightDuration(false);
            intersection.processVehicles(SIMULATION_SPEED);
        }
    });

    updateSimulationArea();
    updateDashboard();
}

function startSimulation() {
    if (!simulationInterval) {
        simulationInterval = setInterval(simulationTick, SIMULATION_SPEED);
        document.getElementById('startSimulation').disabled = true;
        document.getElementById('stopSimulation').disabled = false;
        console.log("Simulation started.");
    }
}

function stopSimulation() {
    clearInterval(simulationInterval);
    simulationInterval = null;
    document.getElementById('startSimulation').disabled = false;
    document.getElementById('stopSimulation').disabled = true;
    console.log("Simulation stopped.");
}

function addEmergencyVehicle() {
    trafficNetwork.generateRandomVehicle('emergency');
    updateSimulationArea();
    updateDashboard();
}

// --- UI Rendering ---
function renderSimulationArea() {
    const simulationArea = document.getElementById('simulationArea');
    simulationArea.innerHTML = '';
    trafficNetwork.intersections.forEach(intersection => {
        const card = document.createElement('div');
        card.id = `intersection-${intersection.id}`;
        card.className = `intersection-card ${intersection.hasEmergencyVehicle ? 'emergency' : ''} shadow-lg hover:shadow-xl transition-all duration-300`;
        card.innerHTML = `
            <h3 class="text-lg font-bold mb-2 flex items-center justify-center">
                Intersection ${intersection.id}
                ${intersection.hasEmergencyVehicle ? '<span class="text-red-500 ml-2 emergency-label">🚨 EMERGENCY</span>' : ''}
            </h3>
            <div class="text-sm text-gray-700">
                <p>Green: <span class="font-semibold">${intersection.currentGreenLight}</span> (<span class="font-mono text-green-700">${intersection.greenLightDuration[intersection.currentGreenLight].toFixed(1)}s</span>)</p>
                <p>Total Vehicles: <span class="font-semibold text-blue-600" id="total-vehicles-${intersection.id}">${intersection.getTotalVehicles()}</span></p>
                <div class="congestion-bar-container">
                    <div class="congestion-bar" id="congestion-bar-${intersection.id}" style="width: ${intersection.congestionLevel.toFixed(1)}%;"></div>
                </div>
                <p class="text-xs text-gray-500 mt-1">Congestion: <span class="font-mono">${intersection.congestionLevel.toFixed(1)}%</span></p>
            </div>
            <div class="direction-stats" id="queues-${intersection.id}"></div>
        `;
        simulationArea.appendChild(card);
    });
}

function updateSimulationArea() {
    trafficNetwork.intersections.forEach(intersection => {
        const card = document.getElementById(`intersection-${intersection.id}`);
        if (!card) return;
        card.classList.toggle('emergency', intersection.hasEmergencyVehicle);
        if (intersection.hasEmergencyVehicle) {
            card.querySelector('h3').innerHTML = `Intersection ${intersection.id} <span class="text-red-500 ml-2 emergency-label">🚨 EMERGENCY</span>`;
        } else {
            card.querySelector('h3').innerHTML = `Intersection ${intersection.id}`;
        }

        const trafficData = intersection.getTrafficData();
        card.querySelector('p span.font-semibold').textContent = trafficData.greenLight;
        card.querySelector('p span.font-mono').textContent = `${trafficData.duration}s`;
        card.querySelector(`#total-vehicles-${intersection.id}`).textContent = trafficData.totalVehiclesProcessed;

        const congestionBar = card.querySelector(`#congestion-bar-${intersection.id}`);
        congestionBar.style.width = `${trafficData.congestion}%`;
        congestionBar.classList.remove('high', 'low');
        if (trafficData.congestion > 70) congestionBar.classList.add('high');
        else if (trafficData.congestion < 30) congestionBar.classList.add('low');

        card.querySelector('.text-xs span.font-mono').textContent = `${trafficData.congestion}%`;

        const queuesDiv = card.querySelector(`#queues-${intersection.id}`);
        queuesDiv.innerHTML = '';
        for (const dir in trafficData.queues) {
            const qData = trafficData.queues[dir];
            const directionItem = document.createElement('div');
            directionItem.className = 'direction-item';
            directionItem.innerHTML = `
                <span class="direction-label">${dir}:</span>
                <span>${qData.size}
                    ${qData.emergency > 0 ? ' <span class="text-red-500 font-bold">(E: ' + qData.emergency + ')</span>' : ''}
                </span>
            `;
            queuesDiv.appendChild(directionItem);
        }
    });
}

function updateDashboard() {
    const dashboardContent = document.getElementById('dashboardContent');
    dashboardContent.innerHTML = '';

    if (trafficNetwork.intersections.size === 0) {
        dashboardContent.innerHTML = '<p class="text-gray-600">No intersections defined.</p>';
        return;
    }

    let totalVehicles = 0;
    let emergencyIntersections = 0;
    let overallCongestionSum = 0;

    trafficNetwork.intersections.forEach(intersection => {
        totalVehicles += intersection.getTotalVehicles();
        if (intersection.hasEmergencyVehicle) emergencyIntersections++;
        overallCongestionSum += parseFloat(intersection.congestionLevel);
    });

    const avgOverallCongestion = trafficNetwork.intersections.size > 0 ? (overallCongestionSum / trafficNetwork.intersections.size).toFixed(1) : 0;

    const overviewDiv = document.createElement('div');
    overviewDiv.className = 'dashboard-item bg-blue-50';
    overviewDiv.innerHTML = `
        <h4 class="text-blue-700">Overall Status</h4>
        <p>Total Vehicles in Queues: <span class="highlight">${totalVehicles}</span></p>
        <p>Intersections with Emergency: <span class="highlight text-red-600">${emergencyIntersections}</span></p>
        <p>Average Congestion: <span class="highlight">${avgOverallCongestion}%</span></p>
    `;
    dashboardContent.appendChild(overviewDiv);

    trafficNetwork.intersections.forEach(intersection => {
        const data = intersection.getTrafficData();
        const itemDiv = document.createElement('div');
        itemDiv.className = `dashboard-item ${data.hasEmergency ? 'bg-red-50' : 'bg-gray-50'}`;
        itemDiv.innerHTML = `
            <h4 class="${data.hasEmergency ? 'text-red-800' : 'text-gray-800'}">${data.id} - ${data.hasEmergency ? '🚨 EMERGENCY' : 'Normal'}</h4>
            <p>Green Light: <span class="highlight">${data.greenLight} (${data.duration}s)</span></p>
            <p>Congestion: <span class="highlight">${data.congestion}%</span></p>
            <p>Vehicles Processed: <span class="highlight">${data.totalVehiclesProcessed}</span></p>
            <p class="font-semibold mt-2">Queue Sizes:</p>
            <ul class="text-xs ml-4 list-disc">
                ${Object.keys(data.queues).map(dir => `
                    <li>${dir}: ${data.queues[dir].size} (R: ${data.queues[dir].regular}, P: ${data.queues[dir].publicTransport}, E: ${data.queues[dir].emergency}) Avg Wait: ${data.queues[dir].avgWaitTime}s</li>
                `).join('')}
            </ul>
        `;
        dashboardContent.appendChild(itemDiv);
    });
}

// --- Modal & Shortest Path Logic ---
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    trafficNetwork.intersections.forEach(intersection => {
        const card = document.getElementById(`intersection-${intersection.id}`);
        if (card) card.classList.remove('path-highlight');
    });
    document.getElementById('pathResult').innerHTML = '';
}

function populatePathModalSelectors() {
    const startNodeSelect = document.getElementById('startNode');
    const endNodeSelect = document.getElementById('endNode');
    startNodeSelect.innerHTML = '';
    endNodeSelect.innerHTML = '';

    trafficNetwork.intersections.forEach(intersection => {
        const option1 = document.createElement('option');
        option1.value = intersection.id;
        option1.textContent = `Intersection ${intersection.id}`;
        startNodeSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = intersection.id;
        option2.textContent = `Intersection ${intersection.id}`;
        endNodeSelect.appendChild(option2);
    });
}

function calculateAndDisplayPath() {
    const startId = document.getElementById('startNode').value;
    const endId = document.getElementById('endNode').value;
    const avoidCongested = document.getElementById('avoidCongested').checked;
    const pathResultDiv = document.getElementById('pathResult');

    trafficNetwork.intersections.forEach(intersection => {
        const card = document.getElementById(`intersection-${intersection.id}`);
        if (card) card.classList.remove('path-highlight');
    });

    const path = trafficNetwork.findShortestPath(startId, endId, avoidCongested);

    if (path.length > 0) {
        pathResultDiv.innerHTML = `<p class="text-green-700 font-semibold">Shortest Path: ${path.join(' → ')}</p>`;
        path.forEach(nodeId => {
            const card = document.getElementById(`intersection-${nodeId}`);
            if (card) card.classList.add('path-highlight');
        });
    } else {
        pathResultDiv.innerHTML = `<p class="text-red-700 font-semibold">No path found between ${startId} and ${endId}. ${avoidCongested ? 'Try without avoiding congested roads.' : ''}</p>`;
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    initializeSimulation();
    document.getElementById('startSimulation').addEventListener('click', startSimulation);
    document.getElementById('stopSimulation').addEventListener('click', stopSimulation);
    document.getElementById('addEmergencyVehicle').addEventListener('click', addEmergencyVehicle);
    document.getElementById('findPath').addEventListener('click', () => openModal('pathModal'));
});
