export class Router {
  routes = [];

  add(method, path, handler) {
    const keys = [];
    const pattern = path.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler });
    return this;
  }

  get(path, h) { return this.add('GET', path, h); }
  post(path, h) { return this.add('POST', path, h); }
  patch(path, h) { return this.add('PATCH', path, h); }
  delete(path, h) { return this.add('DELETE', path, h); }

  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      if (route.method !== method) {
        pathMatched = true;
        continue;
      }
      const params = {};
      route.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1])));
      return { handler: route.handler, params };
    }
    return { handler: null, pathMatched };
  }
}
