import leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  private readonly tileWidth: number;
  private readonly visibilityRadius: number;
  private readonly knownCells: Map<string, Cell> = new Map();

  constructor(tileWidth: number, visibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.visibilityRadius = visibilityRadius;
  }

  private getCanonicalCell(cell: Cell): Cell {
    const key = `${cell.i},${cell.j}`;
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);
    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const origin = leaflet.latLng(0, 0);
    const bounds = leaflet.latLngBounds([
      [
        origin.lat + cell.i * this.tileWidth,
        origin.lng + cell.j * this.tileWidth,
      ],
      [
        origin.lat + (cell.i + 1) * this.tileWidth,
        origin.lng + (cell.j + 1) * this.tileWidth,
      ],
    ]);
    return bounds;
  }
}
