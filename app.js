// Глобальный стейт
let world = {
    worldName: "Новый Мир",
    locations: {},
    characterPool: {}
};

let currentCoords = [25, 25];
let currentMode = 'edit'; 
let activeCharacterIdInModal = null;
let activeTokenElInDrag = null;

// Настройки навигации по карте мира
let mapScale = 0.6;
let mapPanX = 100;
let mapPanY = 100;

// Заглушки графики
const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2325252e'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-size='12'>Пустая локация</text></svg>";
const CHAR_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%233a3a44'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-size='16'>?</text></svg>";

document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
});

function initEventListeners() {
    // Главное меню
    document.getElementById('btn-create-world').addEventListener('click', createNewWorld);
    document.getElementById('upload-world-file').addEventListener('change', loadWorldFromFile);

    // Панель управления экраном приложения
    document.getElementById('btn-toggle-mode').addEventListener('click', toggleMode);
    document.getElementById('btn-save-world').addEventListener('click', saveWorldToFile);
    document.getElementById('btn-exit-menu').addEventListener('click', () => switchScreen('main-menu'));
    document.getElementById('btn-open-global-map').addEventListener('click', openGlobalMap);

    // Стрелочки переходов
    document.querySelectorAll('.arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => handleArrowClick(e.currentTarget.dataset.dir));
    });

    // Картинка локации и её стейты
    document.getElementById('loc-image-input').addEventListener('change', (e) => handleImageUpload(e, 'location'));
    document.getElementById('loc-state-select').addEventListener('change', (e) => switchLocationState(e.target.value));
    document.getElementById('btn-add-state').addEventListener('click', addNewLocationState);
    document.getElementById('btn-delete-state').addEventListener('click', deleteLocationState);

    // Пул и призыв персонажей
    document.getElementById('btn-create-character').addEventListener('click', createNewCharacterInPool);
    document.getElementById('btn-spawn-character').addEventListener('click', spawnCharacterToCurrentLocation);

    // Карточка персонажа
    document.getElementById('close-char-modal').addEventListener('click', () => document.getElementById('modal-char-card').classList.add('hidden'));
    document.getElementById('char-card-image-input').addEventListener('change', (e) => handleImageUpload(e, 'character-form'));
    document.getElementById('char-card-name').addEventListener('input', (e) => updateCharData('name', e.target.value));
    document.getElementById('char-card-desc').addEventListener('input', (e) => updateCharData('desc', e.target.value));
    document.getElementById('char-card-secret').addEventListener('input', (e) => updateCharData('secret', e.target.value));
    
    document.getElementById('btn-toggle-secret').addEventListener('click', () => {
        document.getElementById('char-card-secret').classList.toggle('hidden');
    });
    
    document.getElementById('btn-add-form').addEventListener('click', addCharacterForm);
    document.getElementById('btn-remove-from-loc').addEventListener('click', removeCharacterFromLocation);
    document.getElementById('btn-kill-char').addEventListener('click', toggleKillCharacter);

    // Бросок костей dXX
    document.querySelectorAll('.dice-buttons button').forEach(btn => {
        btn.addEventListener('click', () => {
            const side = parseInt(btn.dataset.dice);
            const res = Math.floor(Math.random() * side) + 1;
            document.getElementById('dice-result').innerText = `Результат: d${side} ➔ 🎲 ${res}`;
        });
    });

    // Модалка карты мира
    document.getElementById('close-map-modal').addEventListener('click', () => document.getElementById('modal-global-map').classList.add('hidden'));

    // Drag-and-drop токенов на холсте
    const canvas = document.getElementById('location-canvas');
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', handleTokenDrop);
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function ensureLocationExists(x, y) {
    const key = `${x},${y}`;
    if (!world.locations[key]) {
        world.locations[key] = {
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
    world = { worldName: name, locations: {}, characterPool: {} };
    currentCoords = [25, 25];
    ensureLocationExists(25, 25);
    setupAppScreen();
}

function setupAppScreen() {
    document.getElementById('display-world-name').innerText = `Мир: ${world.worldName}`;
    currentMode = 'edit';
    
    const btn = document.getElementById('btn-toggle-mode');
    btn.innerText = 'Режим: Редактор';
    btn.className = 'btn-mode-edit';
    document.body.className = 'edit-mode';
    
    document.querySelectorAll('.editor-only').forEach(el => el.classList.remove('hidden'));
    
    switchScreen('app-screen');
    renderCurrentLocation();
    renderCharacterPool();
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
    renderCurrentLocation();
}

function renderCurrentLocation() {
    const loc = ensureLocationExists(currentCoords[0], currentCoords[1]);
    document.getElementById('coord-display').innerText = `${currentCoords[0]},${currentCoords[1]}`;
    
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
        activeState.characters.forEach((cInstance) => {
            const charData = world.characterPool[cInstance.id];
            if (!charData) return;
            const currentForm = charData.forms[charData.currentForm] || charData.forms['default'];

            const token = document.createElement('div');
            token.className = 'char-token';
            if (charData.currentForm === 'dead') token.classList.add('is-dead');
            token.style.left = `${cInstance.x}px`;
            token.style.top = `${cInstance.y}px`;
            token.style.backgroundImage = `url("${currentForm.image || CHAR_PLACEHOLDER}")`;
            token.draggable = (currentMode === 'edit');
            
            token.addEventListener('click', (e) => {
                e.stopPropagation();
                openCharacterCard(cInstance.id);
            });

            token.addEventListener('dragstart', (e) => {
                activeTokenElInDrag = { id: cInstance.id, offsetX: e.offsetX, offsetY: e.offsetY };
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
            arrowBtn.title = `Перейти к ячейке [${loc.connections[dir].join(',')}]`;
        } else {
            arrowBtn.classList.add('not-connected');
            arrowBtn.title = currentMode === 'edit' ? "Нажмите, чтобы проложить путь" : "Пути нет";
        }
    });

    const spawnSelect = document.getElementById('spawn-character-select');
    spawnSelect.innerHTML = '';
    Object.keys(world.characterPool).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = world.characterPool[id].name;
        spawnSelect.appendChild(opt);
    });
}

function handleArrowClick(dir) {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const modifier = {
        'N': [0, -1], 'NE': [1, -1], 'E': [1, 0], 'SE': [1, 1],
        'S': [0, 1], 'SW': [-1, 1], 'W': [-1, 0], 'NW': [-1, -1]
    }[dir];

    const targetCoords = [currentCoords[0] + modifier[0], currentCoords[1] + modifier[1]];
    
    if (targetCoords[0] < 1 || targetCoords[0] > 50 || targetCoords[1] < 1 || targetCoords[1] > 50) {
        alert("Предел сетки! Координаты за рамками поля 50х50.");
        return;
    }

    if (currentMode === 'edit') {
        if (!loc.connections[dir]) {
            if (confirm(`Создать двухсторонний переход в направлении ${dir} к ячейке [${targetCoords.join(',')}]?`)) {
                if (!loc.connections) loc.connections = {};
                loc.connections[dir] = targetCoords;
                
                const oppositeDir = {'N':'S','NE':'SW','E':'W','SE':'NW','S':'N','SW':'NE','W':'E','NW':'SE'}[dir];
                const targetLoc = ensureLocationExists(targetCoords[0], targetCoords[1]);
                if (!targetLoc.connections) targetLoc.connections = {};
                targetLoc.connections[oppositeDir] = [currentCoords[0], currentCoords[1]];
                
                renderCurrentLocation();
            }
            return;
        } else {
            if (confirm(`Удалить существующий переход в направлении ${dir}?`)) {
                delete loc.connections[dir];
                renderCurrentLocation();
                return;
            }
        }
    }

    if (loc.connections && loc.connections[dir]) {
        currentCoords = loc.connections[dir];
        ensureLocationExists(currentCoords[0], currentCoords[1]);
        renderCurrentLocation();
    }
}

function handleTokenDrop(e) {
    e.preventDefault();
    if (!activeTokenElInDrag || currentMode !== 'edit') return;

    const canvas = document.getElementById('location-canvas');
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left - activeTokenElInDrag.offsetX;
    let y = e.clientY - rect.top - activeTokenElInDrag.offsetY;

    x = Math.max(0, Math.min(x, rect.width - 65));
    y = Math.max(0, Math.min(y, rect.height - 65));

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

function handleImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Img = e.target.result;
        const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
        
        if (type === 'location') {
            loc.states[loc.currentState].image = base64Img;
            renderCurrentLocation();
        } else if (type === 'character-form') {
            const char = world.characterPool[activeCharacterIdInModal];
            if (char) {
                char.forms[char.currentForm].image = base64Img;
                document.getElementById('char-card-img').src = base64Img;
                renderCurrentLocation();
                renderCharacterPool();
            }
        }
    };
    reader.readAsDataURL(file);
}

function switchLocationState(stateKey) {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    loc.currentState = stateKey;
    renderCurrentLocation();
}

function addNewLocationState() {
    const name = prompt("Название нового состояния (например: Пожар, Ночь):");
    if (!name) return;
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const stateKey = "state_" + Date.now();
    
    loc.states[stateKey] = {
        name: name,
        image: loc.states[loc.currentState].image || PLACEHOLDER_IMG,
        characters: []
    };
    loc.currentState = stateKey;
    renderCurrentLocation();
}

function deleteLocationState() {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    if (loc.currentState === 'default') {
        alert("Основное состояние нельзя удалить!");
        return;
    }
    if (confirm("Удалить это состояние локации? Размещенные в нем токены исчезнут.")) {
        delete loc.states[loc.currentState];
        loc.currentState = 'default';
        renderCurrentLocation();
    }
}

function createNewCharacterInPool() {
    const name = prompt("Имя персонажа/монстра:");
    if (!name) return;
    const id = "char_" + Date.now();
    world.characterPool[id] = {
        name: name,
        currentForm: "default",
        forms: {
            "default": { name: "Основная", image: CHAR_PLACEHOLDER, desc: "", secret: "" },
            "dead": { name: "Мёртв", image: CHAR_PLACEHOLDER, desc: "Бездыханное тело.", secret: "" }
        }
    };
    renderCharacterPool();
    renderCurrentLocation();
}

function renderCharacterPool() {
    const list = document.getElementById('character-pool-list');
    list.innerHTML = '';
    Object.keys(world.characterPool).forEach(id => {
        const char = world.characterPool[id];
        const activeForm = char.forms[char.currentForm] || char.forms['default'];
        
        const item = document.createElement('div');
        item.className = 'pool-item';
        item.innerHTML = `<img src="${activeForm.image || CHAR_PLACEHOLDER}"> <span>${char.name}</span>`;
        item.addEventListener('click', () => openCharacterCard(id));
        list.appendChild(item);
    });
}

function spawnCharacterToCurrentLocation() {
    const id = document.getElementById('spawn-character-select').value;
    if (!id) return;
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    
    if (!activeState.characters) activeState.characters = [];
    if (activeState.characters.some(c => c.id === id)) {
        alert("Персонаж уже выставлен на этой сцене!");
        return;
    }
    
    activeState.characters.push({ id: id, x: 215, y: 215 });
    renderCurrentLocation();
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

    const formsContainer = document.getElementById('char-forms-buttons');
    formsContainer.innerHTML = '';
    Object.keys(char.forms).forEach(fk => {
        const fBtn = document.createElement('button');
        fBtn.innerText = char.forms[fk].name;
        if (fk === char.currentForm) fBtn.style.border = "2px solid #d19a66";
        fBtn.addEventListener('click', () => {
            char.currentForm = fk;
            openCharacterCard(charId);
            renderCurrentLocation();
        });
        formsContainer.appendChild(fBtn);
    });

    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    const hasOnLoc = activeState.characters && activeState.characters.some(c => c.id === charId);
    document.getElementById('btn-remove-from-loc').style.display = hasOnLoc ? 'block' : 'none';
    
    document.getElementById('btn-kill-char').innerText = char.currentForm === 'dead' ? "Воскресить" : "Убить (Статус: Мертв)";

    document.getElementById('modal-char-card').classList.remove('hidden');
}

function updateCharData(field, val) {
    const char = world.characterPool[activeCharacterIdInModal];
    if (!char) return;
    if (field === 'name') {
        char.name = val;
    } else {
        if (!char.forms[char.currentForm]) return;
        char.forms[char.currentForm][field] = val;
    }
    renderCharacterPool();
}

function addCharacterForm() {
    const name = prompt("Название альтернативного облика (Пример: Оборотень, Берсерк):");
    if (!name) return;
    const char = world.characterPool[activeCharacterIdInModal];
    const fKey = "form_" + Date.now();
    
    char.forms[fKey] = { name: name, image: CHAR_PLACEHOLDER, desc: "", secret: "" };
    char.currentForm = fKey;
    openCharacterCard(activeCharacterIdInModal);
}

function removeCharacterFromLocation() {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    if (activeState.characters) {
        activeState.characters = activeState.characters.filter(c => c.id !== activeCharacterIdInModal);
    }
    document.getElementById('modal-char-card').classList.add('hidden');
    renderCurrentLocation();
}

function toggleKillCharacter() {
    const char = world.characterPool[activeCharacterIdInModal];
    if (!char) return;
    char.currentForm = (char.currentForm === 'dead') ? 'default' : 'dead';
    openCharacterCard(activeCharacterIdInModal);
    renderCurrentLocation();
    renderCharacterPool();
}

function openGlobalMap() {
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    
    for (let y = 1; y <= 50; y++) {
        for (let x = 1; x <= 50; x++) {
            const cellKey = `${x},${y}`;
            const cell = document.createElement('div');
            cell.className = 'map-cell';
            if (x === currentCoords[0] && y === currentCoords[1]) cell.classList.add('active-cell');

            const locData = world.locations[cellKey];
            if (locData) {
                const activeState = locData.states[locData.currentState] || locData.states['default'];
                if (activeState && activeState.image && activeState.image !== PLACEHOLDER_IMG) {
                    const img = document.createElement('img');
                    img.src = activeState.image;
                    cell.appendChild(img);
                } else {
                    cell.style.backgroundColor = '#2c2c35';
                }

                if (activeState && activeState.characters && activeState.characters.length > 0) {
                    const firstCharId = activeState.characters[0].id;
                    const cData = world.characterPool[firstCharId];
                    if (cData) {
                        const form = cData.forms[cData.currentForm] || cData.forms['default'];
                        const pDot = document.createElement('div');
                        pDot.className = 'map-cell-char';
                        pDot.style.backgroundImage = `url("${form.image || CHAR_PLACEHOLDER}")`;
                        cell.appendChild(pDot);
                    }
                }
            }

            cell.addEventListener('click', () => {
                currentCoords = [x, y];
                ensureLocationExists(x, y);
                document.getElementById('modal-global-map').classList.add('hidden');
                renderCurrentLocation();
            });

            grid.appendChild(cell);
        }
    }

    updateMapTransform();
    document.getElementById('modal-global-map').classList.remove('hidden');
    initMapControls();
}

function updateMapTransform() {
    const grid = document.getElementById('map-grid');
    grid.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapScale})`;
}

function initMapControls() {
    const viewport = document.getElementById('map-viewport');
    let isDragging = false;
    let startX, startY;

    viewport.onmousedown = (e) => {
        // Перемещаем только при клике на вьюпорт, не на кнопки закрытия
        if(e.target.classList.contains('close-modal')) return;
        isDragging = true;
        startX = e.clientX - mapPanX;
        startY = e.clientY - mapPanY;
    };

    window.onmousemove = (e) => {
        if (!isDragging) return;
        mapPanX = e.clientX - startX;
        mapPanY = e.clientY - startY;
        updateMapTransform();
    };

    window.onmouseup = () => {
        isDragging = false;
    };

    viewport.onwheel = (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            if (mapScale < 2.5) mapScale *= zoomFactor;
        } else {
            if (mapScale > 0.15) mapScale /= zoomFactor;
        }
        updateMapTransform();
    };
}

function saveWorldToFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(world));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${world.worldName.replace(/\s+/g, '_')}_save.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function loadWorldFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.worldName && parsed.locations) {
                world = parsed;
                if (!world.characterPool) world.characterPool = {};
                
                const keys = Object.keys(world.locations);
                if (keys.length > 0) {
                    currentCoords = keys[0].split(',').map(Number);
                } else {
                    currentCoords = [25, 25];
                    ensureLocationExists(25, 25);
                }
                setupAppScreen();
            } else {
                alert("Ошибка чтения: В файле отсутствуют ключевые поля структуры мира.");
            }
        } catch (err) {
            alert("Не удалось прочесть JSON-файл сохранения. Возможно, он поврежден.");
        }
    };
    reader.readAsText(file);
    // Сбрасываем инпут, чтобы можно было загружать тот же файл повторно
    event.target.value = '';
}
