// Основной стейт приложения
let world = {
    worldName: "Новый Мир",
    locations: {},
    characterPool: {}
};

let currentCoords = [25, 25];
let currentMode = 'edit'; // 'edit' или 'play'
let activeCharacterIdInModal = null;
let activeTokenElInDrag = null;

// Настройки глобальной карты (зум и скролл)
let mapScale = 0.5;
let mapPanX = -800;
let mapPanY = -800;

// Заглушка для пустых локаций
const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%2325252e'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23444' font-size='12'>Нет картинки</text></svg>";
const CHAR_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%233a3a44'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-size='14'>?</text></svg>";

document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
});

function initEventListeners() {
    // Элементы Меню
    document.getElementById('btn-create-world').addEventListener('click', createNewWorld);
    document.getElementById('upload-world-file').addEventListener('change', loadWorldFromFile);

    // Панель навигации/управления
    document.getElementById('btn-toggle-mode').addEventListener('click', toggleMode);
    document.getElementById('btn-save-world').addEventListener('click', saveWorldToFile);
    document.getElementById('btn-exit-menu').addEventListener('click', () => switchScreen('main-menu'));
    document.getElementById('btn-open-global-map').addEventListener('click', openGlobalMap);

    // Стрелки переходов
    document.querySelectorAll('.arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => handleArrowClick(e.target.dataset.dir));
    });

    // Изменение картинки локации и стейты
    document.getElementById('loc-image-input').addEventListener('change', (e) => handleImageUpload(e, 'location'));
    document.getElementById('loc-state-select').addEventListener('change', (e) => switchLocationState(e.target.value));
    document.getElementById('btn-add-state').addEventListener('click', addNewLocationState);
    document.getElementById('btn-delete-state').addEventListener('click', deleteLocationState);

    // Пул персонажей
    document.getElementById('btn-create-character').addEventListener('click', createNewCharacterInPool);
    document.getElementById('btn-spawn-character').addEventListener('click', spawnCharacterToCurrentLocation);

    // Карточка персонажа (модалка)
    document.getElementById('close-char-modal').addEventListener('click', () => document.getElementById('modal-char-card').classList.add('hidden'));
    document.getElementById('char-card-image-input').addEventListener('change', (e) => handleImageUpload(e, 'character-form'));
    document.getElementById('char-card-name').addEventListener('input', (e) => updateCharData('name', e.target.value));
    document.getElementById('char-card-desc').addEventListener('input', (e) => updateCharData('desc', e.target.value));
    document.getElementById('char-card-secret').addEventListener('input', (e) => updateCharData('secret', e.target.value));
    document.getElementById('btn-toggle-secret').addEventListener('click', () => document.getElementById('char-card-secret').classList.toggle('hidden'));
    document.getElementById('btn-add-form').addEventListener('click', addCharacterForm);
    document.getElementById('btn-remove-from-loc').addEventListener('click', removeCharacterFromLocation);
    document.getElementById('btn-kill-char').addEventListener('click', toggleKillCharacter);

    // Бросок костей
    document.querySelectorAll('.dice-buttons button').forEach(btn => {
        btn.addEventListener('click', () => {
            const side = parseInt(btn.dataset.dice);
            const res = Math.floor(Math.random() * side) + 1;
            document.getElementById('dice-result').innerText = `Результат: d${side} ➔ 🎲 ${res}`;
        });
    });

    // Закрытие карты
    document.getElementById('close-map-modal').addEventListener('click', () => document.getElementById('modal-global-map').classList.add('hidden'));

    // Drag and Drop для перемещения персонажей по карте локации
    const canvas = document.getElementById('location-canvas');
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', handleTokenDrop);
}

// Помощники переключения экранов и режимов
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function toggleMode() {
    currentMode = currentMode === 'edit' ? 'play' : 'edit';
    const btn = document.getElementById('btn-toggle-mode');
    btn.innerText = currentMode === 'edit' ? 'Режим: Редактор' : 'Режим: Игра';
    btn.className = currentMode === 'edit' ? 'btn-mode-edit' : 'btn-mode-play';
    
    document.body.className = currentMode === 'edit' ? 'edit-mode' : 'play-mode';
    document.querySelectorAll('.editor-only').forEach(el => {
        currentMode === 'edit' ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
    renderCurrentLocation();
}

// Инициализация локации в стейте, если её там еще нет
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
    const name = document.getElementById('new-world-name').value.trim() || "Без названия";
    world = { worldName: name, locations: {}, characterPool: {} };
    currentCoords = [25, 25];
    ensureLocationExists(25, 25);
    setupAppScreen();
}

function setupAppScreen() {
    document.getElementById('display-world-name').innerText = `Мир: ${world.worldName}`;
    if(currentMode !== 'edit') toggleMode();
    switchScreen('app-screen');
    renderCurrentLocation();
    renderCharacterPool();
}

// Логика отображения локации
function renderCurrentLocation() {
    const loc = ensureLocationExists(currentCoords[0], currentCoords[1]);
    document.getElementById('coord-display').innerText = `${currentCoords[0]},${currentCoords[1]}`;
    
    // Обновляем селектор стейтов
    const select = document.getElementById('loc-state-select');
    select.innerHTML = '';
    Object.keys(loc.states).forEach(sk => {
        const opt = document.createElement('option');
        opt.value = sk;
        opt.innerText = loc.states[sk].name;
        opt.selected = (sk === loc.currentState);
        select.appendChild(opt);
    });

    const activeState = loc.states[loc.currentState];
    const canvas = document.getElementById('location-canvas');
    canvas.style.backgroundImage = `url(${activeState.image || PLACEHOLDER_IMG})`;
    canvas.innerHTML = '';

    // Рендеринг персонажей на локации
    activeState.characters.forEach((cInstance) => {
        const charData = world.characterPool[cInstance.id];
        if(!charData) return;
        const currentForm = charData.forms[charData.currentForm];

        const token = document.createElement('div');
        token.className = 'char-token';
        if (charData.currentForm === 'dead') token.classList.add('is-dead');
        token.style.left = `${cInstance.x}px`;
        token.style.top = `${cInstance.y}px`;
        token.style.backgroundImage = `url(${currentForm.image || CHAR_PLACEHOLDER})`;
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

    // Рендер стрелочек
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach(dir => {
        const arrowBtn = document.querySelector(`.arrow-${dir.toLowerCase()}`);
        if(loc.connections[dir]) {
            arrowBtn.classList.remove('not-connected');
            arrowBtn.title = `Перейти к ${loc.connections[dir].join(',')}`;
        } else {
            arrowBtn.classList.add('not-connected');
            arrowBtn.title = currentMode === 'edit' ? "Нажмите для создания связи" : "Путь заблокирован";
        }
    });

    // Перезагрузка списка для спавна
    const spawnSelect = document.getElementById('spawn-character-select');
    spawnSelect.innerHTML = '';
    Object.keys(world.characterPool).forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = world.characterPool[id].name;
        spawnSelect.appendChild(opt);
    });
}

// Логика перемещений и редактирования связей
function handleArrowClick(dir) {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const modifier = {
        'N': [0, -1], 'NE': [1, -1], 'E': [1, 0], 'SE': [1, 1],
        'S': [0, 1], 'SW': [-1, 1], 'W': [-1, 0], 'NW': [-1, -1]
    }[dir];

    const targetCoords = [currentCoords[0] + modifier[0], currentCoords[1] + modifier[1]];
    
    // Валидация выхода за границы поля 50x50 (от 1 до 50)
    if(targetCoords[0] < 1 || targetCoords[0] > 50 || targetCoords[1] < 1 || targetCoords[1] > 50) {
        alert("Достигнута граница мира (50х50)!");
        return;
    }

    if (currentMode === 'edit') {
        if (!loc.connections[dir]) {
            if(confirm(`Создать связь в направлении ${dir} к ячейке [${targetCoords.join(',')}]?`)) {
                loc.connections[dir] = targetCoords;
                // Автоматически делаем обратную связь для удобства
                const oppositeDir = {'N':'S','NE':'SW','E':'W','SE':'NW','S':'N','SW':'NE','W':'E','NW':'SE'}[dir];
                const targetLoc = ensureLocationExists(targetCoords[0], targetCoords[1]);
                targetLoc.connections[oppositeDir] = [currentCoords[0], currentCoords[1]];
            } else { return; }
        } else {
            // Если связь есть, в режиме редактора клик предлагает её удалить
            if(confirm(`Удалить существующую связь в направлении ${dir}?`)) {
                delete loc.connections[dir];
                renderCurrentLocation();
                return;
            }
        }
    }

    // Если связь существует — переходим
    if (loc.connections[dir]) {
        currentCoords = loc.connections[dir];
        ensureLocationExists(currentCoords[0], currentCoords[1]);
        renderCurrentLocation();
    }
}

// Перетаскивание персонажей
function handleTokenDrop(e) {
    e.preventDefault();
    if(!activeTokenElInDrag || currentMode !== 'edit') return;

    const canvas = document.getElementById('location-canvas');
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left - activeTokenElInDrag.offsetX;
    let y = e.clientY - rect.top - activeTokenElInDrag.offsetY;

    // Держим токен внутри рамок локации
    x = Math.max(0, Math.min(x, rect.width - 60));
    y = Math.max(0, Math.min(y, rect.height - 60));

    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    const charInstance = activeState.characters.find(c => c.id === activeTokenElInDrag.id);
    if(charInstance) {
        charInstance.x = Math.round(x);
        charInstance.y = Math.round(y);
    }
    activeTokenElInDrag = null;
    renderCurrentLocation();
}

// Конвертер изображений в Base64 для полной автономности сохранения в JSON
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
            char.forms[char.currentForm].image = base64Img;
            document.getElementById('char-card-img').src = base64Img;
            renderCurrentLocation();
            renderCharacterPool();
        }
    };
    reader.readAsDataURL(file);
}

// Функции управления состояниями локации
function switchLocationState(stateKey) {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    loc.currentState = stateKey;
    renderCurrentLocation();
}

function addNewLocationState() {
    const name = prompt("Введите название нового состояния локации:");
    if (!name) return;
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const stateKey = "state_" + Date.now();
    
    // Копируем картинку из текущего состояния для базы нового
    loc.states[stateKey] = {
        name: name,
        image: loc.states[loc.currentState].image,
        characters: []
    };
    loc.currentState = stateKey;
    renderCurrentLocation();
}

function deleteLocationState() {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    if (loc.currentState === 'default') {
        alert("Нельзя удалить основное состояние!");
        return;
    }
    if(confirm("Вы уверены, что хотите удалить это состояние локации? Все персонажи на нём пропадут.")) {
        delete loc.states[loc.currentState];
        loc.currentState = 'default';
        renderCurrentLocation();
    }
}

// Логика Персонажей (Пул и Выставление)
function createNewCharacterInPool() {
    const name = prompt("Введите имя нового персонажа:");
    if (!name) return;
    const id = "char_" + Date.now();
    world.characterPool[id] = {
        name: name,
        currentForm: "default",
        forms: {
            "default": { name: "Основная", image: CHAR_PLACEHOLDER, desc: "", stats: "", secret: "" },
            "dead": { name: "Мёртв", image: CHAR_PLACEHOLDER, desc: "Бездыханное тело.", stats: "", secret: "" }
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
        const activeForm = char.forms[char.currentForm];
        
        const item = document.createElement('div');
        item.className = 'pool-item';
        item.innerHTML = `<img src="${activeForm.image || CHAR_PLACEHOLDER}"> <span>${char.name}</span>`;
        item.addEventListener('click', () => openCharacterCard(id));
        list.appendChild(item);
    });
}

function spawnCharacterToCurrentLocation() {
    const id = document.getElementById('spawn-character-select').value;
    if(!id) return;
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    
    if(activeState.characters.some(c => c.id === id)) {
        alert("Этот персонаж уже находится в этом состоянии локации!");
        return;
    }
    
    activeState.characters.push({ id: id, x: 220, y: 220 }); // Спавн по центру
    renderCurrentLocation();
}

// Логика Карточки Персонажа (Модалка)
function openCharacterCard(charId) {
    activeCharacterIdInModal = charId;
    const char = world.characterPool[charId];
    const form = char.forms[char.currentForm];

    document.getElementById('char-card-name').value = char.name;
    document.getElementById('char-card-desc').value = form.desc;
    document.getElementById('char-card-secret').value = form.secret;
    document.getElementById('char-card-img').src = form.image || CHAR_PLACEHOLDER;
    
    // Скрываем секретные характеристики по дефолту при открытии
    document.getElementById('char-card-secret').classList.add('hidden');

    // Кнопки управления формами
    const formsContainer = document.getElementById('char-forms-buttons');
    formsContainer.innerHTML = '';
    Object.keys(char.forms).forEach(fk => {
        const fBtn = document.createElement('button');
        fBtn.innerText = char.forms[fk].name;
        if(fk === char.currentForm) fBtn.style.borderColor = "#d19a66";
        fBtn.addEventListener('click', () => {
            char.currentForm = fk;
            openCharacterCard(charId);
            renderCurrentLocation();
        });
        formsContainer.appendChild(fBtn);
    });

    // Видимость элементов управления локацией на карточке
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const hasOnLoc = loc.states[loc.currentState].characters.some(c => c.id === charId);
    document.getElementById('btn-remove-from-loc').style.display = hasOnLoc ? 'block' : 'none';
    
    document.getElementById('btn-kill-char').innerText = char.currentForm === 'dead' ? "Воскресить" : "Убить";

    document.getElementById('modal-char-card').classList.remove('hidden');
}

function updateCharData(field, val) {
    const char = world.characterPool[activeCharacterIdInModal];
    if (field === 'name') {
        char.name = val;
    } else {
        char.forms[char.currentForm][field] = val;
    }
    renderCharacterPool();
}

function addCharacterForm() {
    const name = prompt("Назовите новую форму (например: Оборотень, Одержимый):");
    if(!name) return;
    const char = world.characterPool[activeCharacterIdInModal];
    const fKey = "form_" + Date.now();
    char.forms[fKey] = { name: name, image: CHAR_PLACEHOLDER, desc: "", stats: "", secret: "" };
    char.currentForm = fKey;
    openCharacterCard(activeCharacterIdInModal);
}

function removeCharacterFromLocation() {
    const loc = world.locations[`${currentCoords[0]},${currentCoords[1]}`];
    const activeState = loc.states[loc.currentState];
    activeState.characters = activeState.characters.filter(c => c.id !== activeCharacterIdInModal);
    document.getElementById('modal-char-card').classList.add('hidden');
    renderCurrentLocation();
}

function toggleKillCharacter() {
    const char = world.characterPool[activeCharacterIdInModal];
    char.currentForm = (char.currentForm === 'dead') ? 'default' : 'dead';
    openCharacterCard(activeCharacterIdInModal);
    renderCurrentLocation();
    renderCharacterPool();
}

// Логика Полной Глобальной Карты
function openGlobalMap() {
    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';
    
    // Настраиваем сетку 50x50 элементов
    for (let y = 1; y <= 50; y++) {
        for (let x = 1; x <= 50; x++) {
            const cellKey = `${x},${y}`;
            const cell = document.createElement('div');
            cell.className = 'map-cell';
            if (x === currentCoords[0] && y === currentCoords[1]) cell.classList.add('active-cell');

            const locData = world.locations[cellKey];
            if (locData) {
                const activeState = locData.states[locData.currentState];
                if(activeState && activeState.image && activeState.image !== PLACEHOLDER_IMG) {
                    const img = document.createElement('img');
                    img.src = activeState.image;
                    cell.appendChild(img);
                } else {
                    cell.style.backgroundColor = '#3a3a44';
                }

                // Рисуем мини-точки для персонажей
                if (activeState && activeState.characters.length > 0) {
                    activeState.characters.forEach(cInst => {
                        const cData = world.characterPool[cInst.id];
                        if (cData) {
                            const pDot = document.createElement('div');
                            pDot.className = 'map-cell-char';
                            pDot.style.backgroundImage = `url(${cData.forms[cData.currentForm].image || CHAR_PLACEHOLDER})`;
                            cell.appendChild(pDot);
                        }
                    });
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
        isDragging = true;
        viewport.style.cursor = 'grabbing';
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
        viewport.style.cursor = 'grab';
    };

    viewport.onwheel = (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            if(mapScale < 2) mapScale *= zoomFactor;
        } else {
            if(mapScale > 0.15) mapScale /= zoomFactor;
        }
        updateMapTransform();
    };
}

// Импорт / Экспорт JSON сейвов
function saveWorldToFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(world, null, 2));
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
                // Находим первую доступную координату для старта
                const keys = Object.keys(world.locations);
                if(keys.length > 0) {
                    currentCoords = keys[0].split(',').map(Number);
                } else {
                    currentCoords = [25, 25];
                    ensureLocationExists(25, 25);
                }
                setupAppScreen();
            } else {
                alert("Неверный формат файла сохранения.");
            }
        } catch (err) {
            alert("Ошибка при чтении файла сохранения.");
        }
    };
    reader.readAsText(file);
}