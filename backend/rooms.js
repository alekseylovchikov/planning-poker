class Rooms {
  static _instanceCache;

  static instance() {
    if (!this._instanceCache) {
      this._instanceCache = new this();
    }

    return this._instanceCache;
  }

  invoke() {
    const rooms = new Map();

    return rooms;
  }
}

export const rooms = new Rooms().invoke();
