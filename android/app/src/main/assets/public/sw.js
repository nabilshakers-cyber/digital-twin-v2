/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-43e44e5a'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "1a6006ce032567d7d9e0bd7caf9fbfb2"
  }, {
    "url": "pwa-512x512.png",
    "revision": "bff9fd34e34ac61048126831bd482c36"
  }, {
    "url": "pwa-192x192.png",
    "revision": "36ae24f8b5aabdfadb25eb462b95c5be"
  }, {
    "url": "index.html",
    "revision": "6ef52b33eeef688343c5c25ab9967b58"
  }, {
    "url": "icon.svg",
    "revision": "79ce18d5b9bfb8f48b832d7260d111b6"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "f0cf9e7c8b99e6ef585d33696b45baac"
  }, {
    "url": "assets/motion-l0sNRNKZ.js",
    "revision": null
  }, {
    "url": "assets/index-D_qdJaP9.js",
    "revision": null
  }, {
    "url": "assets/index-DW3DHC06.css",
    "revision": null
  }, {
    "url": "assets/firebase-CQabkFcD.js",
    "revision": null
  }, {
    "url": "assets/charts-DluBSxny.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "f0cf9e7c8b99e6ef585d33696b45baac"
  }, {
    "url": "icon.svg",
    "revision": "79ce18d5b9bfb8f48b832d7260d111b6"
  }, {
    "url": "manifest.json",
    "revision": "6c398304bf7c08877c62f68d673259c0"
  }, {
    "url": "pwa-192x192.png",
    "revision": "36ae24f8b5aabdfadb25eb462b95c5be"
  }, {
    "url": "pwa-512x512.png",
    "revision": "bff9fd34e34ac61048126831bd482c36"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "1a6006ce032567d7d9e0bd7caf9fbfb2"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(({
    url
  }) => url.pathname.startsWith("/api/"), new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
