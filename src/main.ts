// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Location of our classroom in Oakes College
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Initialize the map centered at the classroom
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Tile layer for background
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player marker with tooltip
const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Player's coin count
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins collected yet...";

// Map to store the persistent state of each cache’s coin count
const cacheData = new Map<string, number>();

// Function to initialize or retrieve a cache’s coin count
function getCacheCoins(i: number, j: number): number {
  const key = `${i},${j}`;
  if (!cacheData.has(key)) {
    const initialCoins = Math.floor(
      luck([i, j, "initialValue"].toString()) * 20,
    );
    cacheData.set(key, initialCoins);
  }
  return cacheData.get(key)!;
}

// Spawn a cache at a specific grid location
function spawnCache(i: number, j: number) {
  const origin = OAKES_CLASSROOM;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    let cacheCoins = getCacheCoins(i, j);

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
    <div>Cache at "${i},${j}" contains <span id="coinCount">${cacheCoins}</span> coins.</div>
    <button id="collect" class="collect-button">Collect</button>
    <button id="deposit" class="deposit-button">Deposit</button>
  `;

    // Collect coins: update the cache data and player coin count
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (cacheCoins > 0) {
          playerCoins += cacheCoins;
          cacheCoins = 0;
          cacheData.set(`${i},${j}`, cacheCoins);
          popupDiv.querySelector<HTMLSpanElement>("#coinCount")!.innerHTML =
            cacheCoins.toString();
          statusPanel.innerHTML = `${playerCoins} coins collected`;
        }
      });

    // Deposit coins: update the cache data and player coin count
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          cacheCoins += playerCoins;
          playerCoins = 0;
          cacheData.set(`${i},${j}`, cacheCoins);
          popupDiv.querySelector<HTMLSpanElement>("#coinCount")!.innerHTML =
            cacheCoins.toString();
          statusPanel.innerHTML = `${playerCoins} coins collected`;
        }
      });

    return popupDiv;
  });
}

// Generate caches around the player
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
