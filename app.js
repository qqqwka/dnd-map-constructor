let world = {
    worldName: "Новый Мир",
    gridSize: 100,
    locations: {},
    characterPool: {}
};

// Структура вкладок (Команд)
let teams = [
    { id: "team_default", name: "Группа 1", coords: [50, 50] }
];
let activeTeamId = "team_default";
let currentCoords = [50, 50]; 

let currentMode = 'edit'; 
let activeCharacterIdInModal = null;
let activeTokenElInDrag = null;
let activeResizeTokenId = null;

let mapScale = 0.5;
let mapPanX = 200;
let mapPanY = 200;

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%2325252e'/></svg>";
const CHAR_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='50' cy='50' r='40' fill='%233a3a44'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-size='16'>?</text></svg>";

document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
});

function initEventListeners() {
    // Входные экраны
    document.getElementById('btn-create-world').addEventListener('click', createNewWorld);
    document.getElementById('upload-world-file').addEventListener('change', loadWorldFromFile);

    // Панель верхняя
    document.getElementById('btn-toggle-mode').addEventListener('click', toggleMode);
    document.getElementById('btn-save-world').addEventListener('click', saveWorldToFile);
    document.getElementById('btn-exit-menu').addEventListener('click', () => switchScreen('main-menu'));
    document.getElementById('btn-open-global-map').addEventListener('click', openGlobalMap);
    document.getElementById('edit-world-size').addEventListener('change', changeWorldSizeInline);

    // Навигация кликами по стрелкам
    document.querySelectorAll('.arrow').forEach(a => {
        a.addEventListener('click', (e) => handleArrowClick(e.currentTarget.dataset.dir));
    });

    // Редактирование параметров локации
    document.getElementById('loc-name-input').addEventListener('input', (e) => {
        const loc = ensureLocationExists(currentCoords[0], currentCoords[1]);
        loc.name = e.target.value;
        updateTeleportSelect();
    });
    document.getElementById('loc-image-input').addEventListener('change', (e) => handleImageUpload(e, 'location'));
    document.getElementById('loc-state-select').addEventListener('change', (e) => {
        const loc = ensureLocationExists(currentCoords[0], currentCoords[1]);
        loc.currentState = e.target.value;
        renderCurrentLocation();
    });
    document.getElementById('btn-add-state').addEventListener('click', addNewLocationState);
    document.getElementById('btn-delete-state').addEventListener('click', deleteLocationState);

    // Быстрые переходы
    document.getElementById('btn-teleport-coords').addEventListener('click', teleportByCoords);
    document.getElementById('teleport-name-select').addEventListener('change', (e) => {
        if (e.target.value) {
            currentCoords = e.target.value.split(',').map(Number);
            syncActiveTeamCoords();
            renderCurrentLocation();
        }
    });

    // Справочник персонажей
    document.getElementById('btn-open-char-manager').addEventListener('click', openCharManager);
    document.getElementById('close-manager-modal').addEventListener('click', () => document.getElementById('modal-char-manager').classList.add('hidden'));
    document.getElementById('char-search-input').addEventListener('input', renderManagerGrid);
    document.getElementById('btn-manager-create-char').addEventListener('click', createNewCharacterInManager);

    // Вкладки групп
    document.getElementById('btn-add-tab').addEventListener('click', addNewTeamTab);

    // Карточка персонажа
    document.getElementById('close-char-modal').addEventListener('click', () => document.getElementById('modal-char-card').classList.add('hidden'));
    document.getElementById('char-card-image-input').addEventListener('change', (e) => handleImageUpload(e, 'character-form'));
    document.getElementById('char-card-name').addEventListener('input', (e) => updateCharData('name', e.target.value));
    document.getElementById('char-card-desc').addEventListener('input', (e) => updateCharData('desc', e.target.value));
    document.getElementById('char-card-secret').addEventListener('input', (e) => updateCharData('secret', e.target.value));
    document.getElementById('btn-toggle-secret').addEventListener('click', () => document.getElementById('char-card-secret').classList.toggle('hidden'));
    document.getElementById('btn-add-form').addEventListener('click', addCharacterForm);
    document.getElementById('btn-card-spawn-here').addEventListener('click', spawnActiveCharToCurrentLocation);
    document.getElementById('btn-remove-from-loc').addEventListener('click', removeCharacterFromLocation);
    document.getElementById('btn-kill-char').addEventListener('click', toggleKillCharacter);

    // Броски кубиков общего назначения
    document.querySelectorAll('.dice-buttons button').forEach(b => {
        b.addEventListener('click', () => {
            const side = parseInt(b.dataset.dice);
            const res = Math.floor(Math.random() * side) + 1;
            document.getElementById('main-dice-result').innerText = `d${side} ➔ 🎲 ${res}`;
        });
    });

    // Закрытие карты
    document.getElementById('close-map-modal').addEventListener('click', () => document.getElementById('modal-global-map').classList.add('hidden'));

    // Drag-and-drop
    const canvas = document.getElementById('location-canvas');
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', handleTokenDrop);
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function ensureLocationExists(x, y) {
    const key = `${x},${y}`;
    if (!world.locations[key]) {
        world.locations[key] = {
            name: `Локация ${key}`,
            connections: {},
            currentState: "default",
            states: {
                "default": { name: "Основное", image: PLACEHOLDER_IMG, characters: [] }
            }
        };
    }
    return world.locations[key];
}

function createNewWorld() {
    const name = document.getElementById('new-world-name').value.trim() || "Новый Мир";
    let size = parseInt(document.getElementById('new-world-size').value) || 100;
    if (size < 10) size = 10;

    world = { worldName: name, gridSize: size, locations: {}, characterPool: {} };
    const center = Math.floor(size / 2);
    currentCoords = [center, center];
    
    teams = [{ id: "team_default", name: "Группа 1", coords: [center, center] }];
    activeTeamId = "team_default";

    ensureLocationExists(center, center);
    setupAppScreen();
}

function changeWorldSizeInline(e) {
    let newSize = parseInt(e.target.value);
    let minNeeded = 10;
    Object.keys(world.locations).forEach(k => {
        const [x, y] = k.split(',').map(Number);
        if (x > minNeeded) minNeeded = x;
        if (y > minNeeded) minNeeded = y;
    });

    if (newSize < minNeeded) {
        alert(`Нельзя сжать мир меньше чем ${minNeeded}x${minNeeded}, так как там уже есть созданные локации.`);
        document.getElementById('edit-world-size').value = world.gridSize;
        return;
    }
    world.gridSize = newSize;
}

function setupAppScreen() {
    document.getElementById('display-world-name').innerText = `Мир: ${world.worldName}`;
    document.getElementById('edit-world-size').value = world.gridSize;
    currentMode = 'edit';
    
    const btn = document.getElementById('btn-toggle-mode');
    btn.innerText = 'Режим: Редактор';
    btn.className = 'btn-mode-edit';
    document.body.className = 'edit-mode';
    
    document.querySelectorAll('.editor-only').forEach(el => el.classList.remove('hidden'));
    
    switchScreen('app-screen');
    renderTabs();
    renderCurrentLocation();
    updateTeleportSelect();
}

function toggleMode() {
    currentMode = currentMode === 'edit' ? 'play' : 'edit';
    const btn = document.getElementById('btn-toggle-mode');
    
    if (currentMode === 'edit') {
        btn.innerText = 'Режим: Редактор';
        btn.className = 'btn-mode-edit';
        document.body.className = 'edit-mode';
        document.querySelectorAll('.editor-only').forEach(el => el.classList.remove('hidden'));
    } else {
        btn.innerText = 'Режим: Игра';
        btn.className = 'btn-mode-play';
        document.body.className = 'play-mode';
        document.querySelectorAll('.editor-only').forEach(el => el.classList.add('hidden'));
    }
    renderTabs();
    renderCurrentLocation();
}

/* Система вкладок (Команды) */
function renderTabs() {
    const wrapper = document.getElementById('tabs-wrapper');
    wrapper.innerHTML = '';
    
    teams.forEach(t => {
        const tab = document.createElement('div');
        tab.className = `team-tab ${t.id === activeTeamId ? 'active-tab' : ''}`;
        
        // В режиме игры можно переименовать вкладку, в редакторе просто текст
        if (currentMode === 'play') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = t.name;
            input.addEventListener('change', (e) => { t.name = e.target.value; });
            tab.appendChild(input);
        } else {
            const span = document.createElement('span');
            span.innerText = t.name;
            tab.appendChild(span);
        }

        const info = document.createElement('span');
        info.style.fontSize = '11px';
        info.style.color = '#888';
        info.innerText = `[${t.coords.join(',')}]`;
        tab.appendChild(info);

        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close') || e.target.tagName === 'INPUT') return;
            activeTeamId = t.id;
            currentCoords = [...t.coords];
            renderTabs();
            renderCurrentLocation();
        });

        if (teams.length > 1) {
            const close = document.createElement('span');
            close.className = 'tab-close';
            close.innerHTML = '&times;';
            close.addEventListener('click', () => {
                teams = teams.filter(item => item.id !== t.id);
                if (activeTeamId === t.id) activeTeamId = teams[0].id;
                currentCoords = [...teams.find(item => item.id === activeTeamId).coords];
                renderTabs();
                renderCurrentLocation();
            });
            tab.appendChild(close);
        }

        wrapper.appendChild(tab);
    });
}

function addNewTeamTab() {
    const id = "team_" + Date.now();
    const name = `Группа ${teams.length + 1}`;
    teams.push({ id: id, name: name, coords: [...currentCoords] });
    activeTeamId = id;
    renderTabs();
}

function syncActiveTeamCoords() {
    const activeTeam = teams.find(t => t.id === activeTeamId);
    if (activeTeam) {
        activeTeam.coords = [...currentCoords];
    }
    renderTabs();
}

function renderCurrentLocation() {
    const loc = ensureLocationExists(currentCoords[0], currentCoords[1]);
    document.getElementById('coord-display').innerText = `${currentCoords[0]},${currentCoords[1]}`;
    document.getElementById('loc-name-input').value = loc.name || '';

    const select = document.getElementById('loc-state-select');
    select.innerHTML = '';
    Object.keys(loc.states).forEach(sk => {
        const opt = document.createElement('option');
        opt.value = sk;
        opt.innerText = loc.states[sk].name;
        opt.selected = (sk === loc.currentState);
        select.appendChild(opt);
    });

    const activeState = loc.states[loc.currentState] || loc.states['default'];
    const canvas = document.getElementById('location-canvas');
    canvas.style.backgroundImage = `url("${activeState.image || PLACEHOLDER_IMG}")`;
    canvas.innerHTML = '';

    if (activeState.characters) {
        activeState.characters.forEach((cInst) => {
            const cData = world.characterPool[cInst.id];
            if (!cData) return;
            const currentForm = cData.forms[cData.currentForm] || cData.forms['default'];

            const token = document.createElement('div');
            token.className = 'char-token';
            if (cData.currentForm === 'dead') token.classList.add('is-dead');
            
            const size = cInst.size || 75;
            token.style.width = `${size}px`;
            token.style.height = `${size}px`;
            token.style.left = `${cInst.x}px`;
            token.style.top = `${cInst.y}px`;
            token.style.backgroundImage = `url("${currentForm.image || CHAR_PLACEHOLDER}")`;
            token.draggable = (currentMode === 'edit');

            token.addEventListener('click', (e) => {
                e.stopPropagation();
                openCharacterCard(cInst.id);
            });

            // ПКМ изменение размеров в редакторе
            token.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (currentMode !== 'edit') return;
                
                if (activeResizeTokenId === cInst.id) {
                    activeResizeTokenId = null;
                    renderCurrentLocation();
                } else {
                    activeResizeTokenId = cInst.id;
                    renderCurrentLocation();
                }
            });

            if (currentMode === 'edit' && activeResizeTokenId === cInst.id) {
                const resizePanel = document.createElement('div');
                resizePanel.className = 'token-resize-panel';
                
                const plusBtn = document.createElement('button');
                plusBtn.innerText = '＋';
                plusBtn.onclick = (ev) => { ev.stopPropagation(); cInst.size = (cInst.size || 75) + 5; renderCurrentLocation(); };
                
                const minusBtn = document.createElement('button');
                minusBtn.innerText = '－';
                minusBtn.onclick = (ev) => { ev.stopPropagation(); cInst.size = Math.max(30, (cInst.size || 75) - 5); renderCurrentLocation(); };
                
                resizePanel.appendChild(plusBtn);
                resizePanel.appendChild(minusBtn);
                token.appendChild(resizePanel);
            }

            token.addEventListener('dragstart', (e) => {
                activeTokenElInDrag = { id: cInst.id, offsetX: e.offsetX, offsetY: e.offsetY };
            });

            canvas.appendChild(token);
        });
    }

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach(dir => {
        const arrowBtn = document.querySelector(`.arrow-${dir.toLowerCase()}`);
        if (!arrowBtn) return;
        if (loc.connections && loc.connections[dir]) {
            arrowBtn.classList.remove('not-connected');
        } else {
            arrowBtn.classList.add('not-connected');
        }
    });
}

function handleArrowClick(dir) {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const modifier = {
        'N': [0, -1], 'NE': [1, -1], 'E': [1, 0], 'SE': [1, 1],
        'S': [0, 1], 'SW': [-1, 1], 'W': [-1, 0], 'NW': [-1, -1]
    }[dir];

    const target = [currentCoords[0] + modifier[0], currentCoords[1] + modifier[1]];
    
    if (target[0] < 1 || target[0] > world.gridSize || target[1] < 1 || target[1] > world.gridSize) {
        alert("Предел сетки установленного мира!");
        return;
    }

    if (currentMode === 'edit') {
        if (!loc.connections[dir]) {
            if (confirm(`Создать переход к ячейке [${target.join(',')}]?`)) {
                loc.connections[dir] = target;
                const opposite = {'N':'S','NE':'SW','E':'W','SE':'NW','S':'N','SW':'NE','W':'E','NW':'SE'}[dir];
                const targetLoc = ensureLocationExists(target[0], target[1]);
                targetLoc.connections[opposite] = [currentCoords[0], currentCoords[1]];
                renderCurrentLocation();
            }
            return;
        } else {
            if (confirm(`Удалить переход в направлении ${dir}?`)) {
                delete loc.connections[dir];
                renderCurrentLocation();
                return;
            }
        }
    }

    if (loc.connections && loc.connections[dir]) {
        currentCoords = loc.connections[dir];
        syncActiveTeamCoords();
        ensureLocationExists(currentCoords[0], currentCoords[1]);
        renderCurrentLocation();
    }
}

function handleTokenDrop(e) {
    e.preventDefault();
    if (!activeTokenElInDrag || currentMode !== 'edit') return;

    const canvas = document.getElementById('location-canvas');
    const rect = canvas.getBoundingClientRect();
    const tokenSize = 75; 
    let x = e.clientX - rect.left - activeTokenElInDrag.offsetX;
    let y = e.clientY - rect.top - activeTokenElInDrag.offsetY;

    x = Math.max(0, Math.min(x, rect.width - tokenSize));
    y = Math.max(0, Math.min(y, rect.height - tokenSize));

    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    const charInstance = activeState.characters.find(c => c.id === activeTokenElInDrag.id);
    if (charInstance) {
        charInstance.x = Math.round(x);
        charInstance.y = Math.round(y);
    }
    activeTokenElInDrag = null;
    renderCurrentLocation();
}

function teleportByCoords() {
    const x = parseInt(document.getElementById('teleport-x').value);
    const y = parseInt(document.getElementById('teleport-y').value);
    if (x >= 1 && x <= world.gridSize && y >= 1 && y <= world.gridSize) {
        currentCoords = [x, y];
        syncActiveTeamCoords();
        ensureLocationExists(x, y);
        renderCurrentLocation();
    } else {
        alert("Некорректные координаты");
    }
}

function updateTeleportSelect() {
    const sel = document.getElementById('teleport-name-select');
    sel.innerHTML = '<option value="">Поиск по имени...</option>';
    Object.keys(world.locations).forEach(k => {
        const l = world.locations[k];
        if (l.name) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = `${l.name} [${k}]`;
            sel.appendChild(opt);
        }
    });
}

function handleImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
        if (type === 'location') {
            loc.states[loc.currentState].image = base64;
            renderCurrentLocation();
        } else if (type === 'character-form') {
            const char = world.characterPool[activeCharacterIdInModal];
            if (char) {
                char.forms[char.currentForm].image = base64;
                document.getElementById('char-card-img').src = base64;
                renderCurrentLocation();
            }
        }
    };
    reader.readAsDataURL(file);
}

function addNewLocationState() {
    const name = prompt("Имя состояния:");
    if (!name) return;
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const sk = "state_" + Date.now();
    loc.states[sk] = { name: name, image: loc.states[loc.currentState].image || PLACEHOLDER_IMG, characters: [] };
    loc.currentState = sk;
    renderCurrentLocation();
}

function deleteLocationState() {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    if (loc.currentState === 'default') return alert("Основное состояние неудаляемо");
    if (confirm("Удалить состояние?")) {
        delete loc.states[loc.currentState];
        loc.currentState = 'default';
        renderCurrentLocation();
    }
}

/* Справочник Персонажей */
function openCharManager() {
    document.getElementById('modal-char-manager').classList.remove('hidden');
    renderManagerGrid();
}

function renderManagerGrid() {
    const query = document.getElementById('char-search-input').value.toLowerCase();
    const grid = document.getElementById('manager-char-list');
    grid.innerHTML = '';

    Object.keys(world.characterPool).forEach(id => {
        const char = world.characterPool[id];
        if (char.name.toLowerCase().includes(query)) {
            const form = char.forms[char.currentForm] || char.forms['default'];
            const el = document.createElement('div');
            el.className = 'manager-item';
            el.innerHTML = `<img src="${form.image || CHAR_PLACEHOLDER}"><span>${char.name}</span>`;
            el.onclick = () => {
                document.getElementById('modal-char-manager').classList.add('hidden');
                openCharacterCard(id);
            };
            grid.appendChild(el);
        }
    });
}

function createNewCharacterInManager() {
    const name = prompt("Имя персонажа:");
    if (!name) return;
    const id = "char_" + Date.now();
    world.characterPool[id] = {
        name: name,
        currentForm: "default",
        forms: {
            "default": { name: "Основная", image: CHAR_PLACEHOLDER, desc: "", secret: "" },
            "dead": { name: "Мёртв", image: CHAR_PLACEHOLDER, desc: "Мертв.", secret: "" }
        }
    };
    renderManagerGrid();
}

function openCharacterCard(charId) {
    activeCharacterIdInModal = charId;
    const char = world.characterPool[charId];
    const form = char.forms[char.currentForm] || char.forms['default'];

    document.getElementById('char-card-name').value = char.name;
    document.getElementById('char-card-desc').value = form.desc || '';
    document.getElementById('char-card-secret').value = form.secret || '';
    document.getElementById('char-card-img').src = form.image || CHAR_PLACEHOLDER;
    document.getElementById('char-card-secret').classList.add('hidden');

    const fc = document.getElementById('char-forms-buttons');
    fc.innerHTML = '';
    Object.keys(char.forms).forEach(fk => {
        const b = document.createElement('button');
        b.innerText = char.forms[fk].name;
        if (fk === char.currentForm) b.style.border = "2px solid #d19a66";
        b.onclick = () => { char.currentForm = fk; openCharacterCard(charId); renderCurrentLocation(); };
        fc.appendChild(b);
    });

    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const has = loc.states[loc.currentState].characters?.some(c => c.id === charId);
    document.getElementById('btn-remove-from-loc').style.display = has ? 'block' : 'none';
    document.getElementById('btn-kill-char').innerText = char.currentForm === 'dead' ? "Воскресить" : "Убить";

    document.getElementById('modal-char-card').classList.remove('hidden');
}

function spawnActiveCharToCurrentLocation() {
    if (!activeCharacterIdInModal) return;
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const state = loc.states[loc.currentState];
    if (!state.characters) state.characters = [];
    if (state.characters.some(c => c.id === activeCharacterIdInModal)) return alert("Уже на локации");
    
    state.characters.push({ id: activeCharacterIdInModal, x: 260, y: 260, size: 75 });
    document.getElementById('modal-char-card').classList.add('hidden');
    renderCurrentLocation();
}

function updateCharData(field, val) {
    const char = world.characterPool[activeCharacterIdInModal];
    if (!char) return;
    if (field === 'name') char.name = val;
    else char.forms[char.currentForm][field] = val;
}

function addCharacterForm() {
    const name = prompt("Имя облика:");
    if (!name) return;
    const char = world.characterPool[activeCharacterIdInModal];
    const fk = "form_" + Date.now();
    char.forms[fk] = { name: name, image: CHAR_PLACEHOLDER, desc: "", secret: "" };
    char.currentForm = fk;
    openCharacterCard(activeCharacterIdInModal);
}

function removeCharacterFromLocation() {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const s = loc.states[loc.currentState];
    if (s.characters) s.characters = s.characters.filter(c => c.id !== activeCharacterIdInModal);
    document.getElementById('modal-char-card').classList.add('hidden');
    renderCurrentLocation();
}

function toggleKillCharacter() {
    const char = world.characterPool[activeCharacterIdInModal];
    char.currentForm = char.currentForm === 'dead' ? 'default' : 'dead';
    openCharacterCard(activeCharacterIdInModal);
    renderCurrentLocation();
}

/* Глобальная карта */
function openGlobalMap() {
    document.getElementById('map-dimension-title').innerText = `${world.gridSize}x${world.gridSize}`;
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';

    // Оптимизированный рендер структуры строк
    for (let y = 1; y <= world.gridSize; y++) {
        const row = document.createElement('div');
        row.className = 'map-row';
        
        for (let x = 1; x <= world.gridSize; x++) {
            const key = `${x},${y}`;
            const cell = document.createElement('div');
            cell.className = 'map-cell';
            if (x === currentCoords[0] && y === currentCoords[1]) cell.classList.add('active-cell');

            const locData = world.locations[key];
            if (locData) {
                const s = locData.states[locData.currentState] || locData.states['default'];
                if (s && s.image && s.image !== PLACEHOLDER_IMG) {
                    const img = document.createElement('img');
                    img.src = s.image;
                    cell.appendChild(img);
                } else {
                    cell.style.backgroundColor = '#2c2c35';
                }
                if (s.characters && s.characters.length > 0) {
                    const c = world.characterPool[s.characters[0].id];
                    if (c) {
                        const form = c.forms[c.currentForm] || c.forms['default'];
                        const dot = document.createElement('div');
                        dot.className = 'map-cell-char';
                        dot.style.backgroundImage = `url("${form.image || CHAR_PLACEHOLDER}")`;
                        cell.appendChild(dot);
                    }
                }
            }

            // Запоминаем координаты в ячейку
            cell.dataset.x = x;
            cell.dataset.y = y;
            row.appendChild(cell);
        }
        grid.appendChild(row);
    }

    // Автоматическая фокусировка на выбранной локации
    const cellWidth = 70; 
    const vp = document.getElementById('map-viewport');
    mapPanX = (vp.clientWidth / 2) - (currentCoords[0] * cellWidth * mapScale) + (cellWidth * mapScale / 2);
    mapPanY = (vp.clientHeight / 2) - (currentCoords[1] * cellWidth * mapScale) + (cellWidth * mapScale / 2);

    updateMapTransform();
    document.getElementById('modal-global-map').classList.remove('hidden');
    initMapControls();
}

function updateMapTransform() {
    const grid = document.getElementById('map-grid');
    grid.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapScale})`;
}

function initMapControls() {
    const vp = document.getElementById('map-viewport');
    let isDrag = false;
    let sX, sY;
    let moveCount = 0; // Для отсечения микро-движений зажатия мыши

    vp.onmousedown = (e) => {
        if (e.target.classList.contains('close-modal')) return;
        isDrag = true;
        moveCount = 0;
        sX = e.clientX - mapPanX;
        sY = e.clientY - mapPanY;
    };

    window.onmousemove = (e) => {
        if (!isDrag) return;
        moveCount++;
        mapPanX = e.clientX - sX;
        mapPanY = e.clientY - sY;
        updateMapTransform();
    };

    window.onmouseup = (e) => {
        if (!isDrag) return;
        isDrag = false;
        
        // Защита от ложного клика: если сдвинули мышь больше чем на 5px, не телепортируем
        if (moveCount < 5) {
            const cell = e.target.closest('.map-cell');
            if (cell) {
                const x = parseInt(cell.dataset.x);
                const y = parseInt(cell.dataset.y);
                currentCoords = [x, y];
                syncActiveTeamCoords();
                ensureLocationExists(x, y);
                document.getElementById('modal-global-map').classList.add('hidden');
                renderCurrentLocation();
            }
        }
    };

    vp.onwheel = (e) => {
        e.preventDefault();
        const factor = 1.1;
        if (e.deltaY < 0) { if (mapScale < 3.0) mapScale *= factor; }
        else { if (mapScale > 0.1) mapScale /= factor; }
        updateMapTransform();
    };
}

function saveWorldToFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({world, teams, activeTeamId}));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `${world.worldName.replace(/\s+/g, '_')}_save.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function loadWorldFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.world) {
                world = parsed.world;
                teams = parsed.teams || [{ id: "team_default", name: "Группа 1", coords: [50, 50] }];
                activeTeamId = parsed.activeTeamId || teams[0].id;
                currentCoords = [...teams.find(t => t.id === activeTeamId).coords];
            } else {
                world = parsed; 
                const center = Math.floor((world.gridSize || 100) / 2);
                teams = [{ id: "team_default", name: "Группа 1", coords: [center, center] }];
                activeTeamId = "team_default";
                currentCoords = [center, center];
            }
            if (!world.characterPool) world.characterPool = {};
            setupAppScreen();
        } catch (err) {
            alert("Ошибка загрузки файла.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
