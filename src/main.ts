import leaflet from "leaflet";
import { Board, Cell } from "./board.ts";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Configuration
const CONFIG = {
  OAKES_CLASSROOM: leaflet.latLng(36.98949379578401, -122.06277128548504),
  GAMEPLAY_ZOOM_LEVEL: 19,
  TILE_DEGREES: 1e-4,
  NEIGHBORHOOD_SIZE: 8,
  CACHE_SPAWN_PROBABILITY: 0.1,
};

// GameState encapsulating global variables
const GameState = {
  playerCoins: 0,
  cacheStore: {} as Record<string, Cache>,
  statusPanel: document.querySelector<HTMLDivElement>("#statusPanel")!,
  map: leaflet.map(document.getElementById("map")!, {
    center: CONFIG.OAKES_CLASSROOM,
    zoom: CONFIG.GAMEPLAY_ZOOM_LEVEL,
    minZoom: CONFIG.GAMEPLAY_ZOOM_LEVEL,
    maxZoom: CONFIG.GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  }),
};

// Cache interface
interface Cache {
  cell: Cell;
  coins: number;
}

// Helper functions for Cache operations
function getCacheKey(cell: Cell): string {
  return `${cell.i},${cell.j}`;
}

function createCache(cell: Cell): Cache {
  const key = getCacheKey(cell);
  const coins = GameState.cacheStore[key]?.coins ??
    Math.floor(luck([cell.i, cell.j, "initialValue"].toString()) * 20);
  return { cell, coins };
}

function saveCache(cache: Cache): void {
  GameState.cacheStore[getCacheKey(cache.cell)] = cache;
}

// Initialize the map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(GameState.map);

// Player marker
const playerMarker = leaflet.marker(CONFIG.OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(GameState.map);

// Update player coin count in UI
function updateStatusPanel() {
  GameState.statusPanel.innerHTML = `${GameState.playerCoins} coins collected`;
}

// Create a rectangle for the cache
function createRectangle(cell: Cell): leaflet.Rectangle {
  const bounds = board.getCellBounds(cell);
  return leaflet.rectangle(bounds).addTo(GameState.map);
}

// Bind popup functionality to a cache rectangle
function bindPopup(rect: leaflet.Rectangle, cache: Cache) {
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at "${cache.cell.i},${cache.cell.j}" contains <span id="coinCount">${cache.coins}</span> coins.</div>
      <button id="collect" class="collect-button">Collect</button>
      <button id="deposit" class="deposit-button">Deposit</button>
    `;

    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => handleCollect(cache, popupDiv));

    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => handleDeposit(cache, popupDiv));

    return popupDiv;
  });
}

// Handle coin collection
function handleCollect(cache: Cache, popupDiv: HTMLElement) {
  if (cache.coins > 0) {
    GameState.playerCoins += cache.coins;
    cache.coins = 0;
    saveCache(cache);
    popupDiv.querySelector<HTMLSpanElement>("#coinCount")!.innerHTML = cache
      .coins.toString();
    updateStatusPanel();
    saveGameState();
  }
}

// Handle coin deposit
function handleDeposit(cache: Cache, popupDiv: HTMLElement) {
  if (GameState.playerCoins > 0) {
    cache.coins += GameState.playerCoins;
    GameState.playerCoins = 0;
    saveCache(cache);
    popupDiv.querySelector<HTMLSpanElement>("#coinCount")!.innerHTML = cache
      .coins.toString();
    updateStatusPanel();
    saveGameState();
  }
}

// Spawn a cache
function spawnCache(cell: Cell) {
  const cache = createCache(cell);
  const rect = createRectangle(cell);
  bindPopup(rect, cache);
  saveCache(cache);
}

// Regenerate caches based on the player's position
function regenerateCaches(center: leaflet.LatLng) {
  GameState.map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      GameState.map.removeLayer(layer);
    }
  });

  for (let i = -CONFIG.NEIGHBORHOOD_SIZE; i < CONFIG.NEIGHBORHOOD_SIZE; i++) {
    for (let j = -CONFIG.NEIGHBORHOOD_SIZE; j < CONFIG.NEIGHBORHOOD_SIZE; j++) {
      const lat = center.lat + i * CONFIG.TILE_DEGREES;
      const lng = center.lng + j * CONFIG.TILE_DEGREES;
      const cellPoint = leaflet.latLng(lat, lng);
      const cell = board.getCellForPoint(cellPoint);

      if (luck([cell.i, cell.j].toString()) < CONFIG.CACHE_SPAWN_PROBABILITY) {
        spawnCache(cell);
      }
    }
  }
}

// Movement buttons
const buttons = document.getElementById("movement-buttons")!;

function movePlayer(latDelta: number, lngDelta: number) {
  const newLat = playerMarker.getLatLng().lat + latDelta;
  const newLng = playerMarker.getLatLng().lng + lngDelta;
  playerMarker.setLatLng([newLat, newLng]);
  updateMovementHistory();
  regenerateCaches(playerMarker.getLatLng());
}

buttons
  .querySelector("#up")
  ?.addEventListener("click", () => movePlayer(CONFIG.TILE_DEGREES, 0));
buttons
  .querySelector("#down")
  ?.addEventListener("click", () => movePlayer(-CONFIG.TILE_DEGREES, 0));
buttons
  .querySelector("#left")
  ?.addEventListener("click", () => movePlayer(0, -CONFIG.TILE_DEGREES));
buttons
  .querySelector("#right")
  ?.addEventListener("click", () => movePlayer(0, CONFIG.TILE_DEGREES));

// Board instance
const board = new Board(CONFIG.TILE_DEGREES, CONFIG.NEIGHBORHOOD_SIZE);
regenerateCaches(CONFIG.OAKES_CLASSROOM);

// Initialize persistent storage keys
const STORAGE_KEYS = {
  PLAYER_POSITION: "playerPosition",
  CACHE_STORE: "cacheStore",
  PLAYER_COINS: "playerCoins",
  MOVEMENT_HISTORY: "movementHistory",
};

// Load game state from storage
function loadGameState() {
  const savedPosition = localStorage.getItem(STORAGE_KEYS.PLAYER_POSITION);
  if (savedPosition) {
    const [lat, lng] = JSON.parse(savedPosition);
    playerMarker.setLatLng([lat, lng]);
    GameState.map.setView([lat, lng], CONFIG.GAMEPLAY_ZOOM_LEVEL);
  }
  const savedCacheStore = localStorage.getItem(STORAGE_KEYS.CACHE_STORE);
  if (savedCacheStore) {
    GameState.cacheStore = JSON.parse(savedCacheStore);
  }
  const savedCoins = localStorage.getItem(STORAGE_KEYS.PLAYER_COINS);
  if (savedCoins) {
    GameState.playerCoins = parseInt(savedCoins, 10);
    updateStatusPanel();
  }
  const savedPolyLine = localStorage.getItem(STORAGE_KEYS.MOVEMENT_HISTORY);
  if (savedPolyLine) {
    const polylineCoordinates = JSON.parse(savedPolyLine);
    movementPolyline.setLatLngs(polylineCoordinates);
  }
}

// Save game state to storage
function saveGameState() {
  const position = playerMarker.getLatLng();
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_POSITION,
    JSON.stringify([position.lat, position.lng]),
  );
  localStorage.setItem(
    STORAGE_KEYS.CACHE_STORE,
    JSON.stringify(GameState.cacheStore),
  );
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_COINS,
    GameState.playerCoins.toString(),
  );
  localStorage.setItem(
    STORAGE_KEYS.MOVEMENT_HISTORY,
    JSON.stringify(movementPolyline.getLatLngs()),
  );
}

// Polyline to track movement history
const movementPolyline = leaflet
  .polyline([], { color: "blue" })
  .addTo(GameState.map);

// Update movement history
function updateMovementHistory() {
  const position = playerMarker.getLatLng();
  movementPolyline.addLatLng([position.lat, position.lng]);
  saveGameState();
}

// Geolocation tracking
function enableGeolocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      playerMarker.setLatLng([lat, lng]);
      GameState.map.setView([lat, lng], CONFIG.GAMEPLAY_ZOOM_LEVEL);
      updateMovementHistory();
    },
    (err) => alert(`Error fetching location: ${err.message}`),
  );
}

// Reset game state
function resetGameState() {
  if (confirm("Are you sure you want to reset the game state?")) {
    localStorage.clear();
    location.reload();
  }
}

// UI Buttons for geolocation and reset
document
  .querySelector("#geolocationButton")
  ?.addEventListener("click", enableGeolocation);
document
  .querySelector("#resetButton")
  ?.addEventListener("click", resetGameState);

// Initialize game state and movement history
loadGameState();
updateMovementHistory();
