---
title: The uuid Package Is Optional Now
description: >-
  Almost all of my projects use the uuid dependency. However, I recently
  realized that the dependency is no longer necessary if you’re only generating
  UUID v4. Both modern browsers and Node.js already p
thumbnail: /article/the-uuid-package-is-optional-now/thumbnail.jpg
createdAt: 05-08-2026
writer: zeetec20
tag:
  - optimization
  - uuid
  - javascript
  - nodejs
  - software-engineering
source: medium
sourceUrl: >-
  https://firmanlestari.medium.com/the-uuid-package-is-optional-now-3516dec3e792?source=rss-de2e53234d37------2
---
Almost all of my projects use the `uuid` dependency. However, I recently realized that the dependency is no longer necessary if you’re only generating **UUID v4**. Both modern browsers and Node.js already provide a built-in API for this.

For **Node.js**, `crypto.randomUUID()` has been available since **v14.17.0**. On the browser side, the API has been widely supported across all major browsers since **March 2022**. Here are the minimum supported versions:

- 🌐 **Google Chrome**: Version **92** (Released July 2021)

- 🧭 **Microsoft Edge**: Version **92** (Released July 2021)

- 🦊 **Mozilla Firefox**: Version **95** (Released December 2021)

- 🍎 **Apple Safari**: Version **15.4** (Released March 2022)

So, whether you should remove the `uuid` dependency depends on your project structure, runtime, and target users.

If your project runs entirely on the **Node.js runtime** and only uses **UUID v4**, you can safely migrate to the built-in API. Since you control the runtime version, you can simply require Node.js **14.17+** or newer.

However, if your project runs in the **browser**, you need to consider your users. Are you confident that your users are using browsers released after **March 2022** (or the minimum versions listed above)? If the answer is yes, then you can also migrate to the built-in API. Otherwise, keeping the external `uuid` package is still the safer option for widely browser compatibility.

Now, let’s look at the implementation.

The UUID generation function is available through the **Crypto API**, which provides built-in cryptographic functionality for JavaScript environments. You can learn more about it in the MDN documentation: [https://developer.mozilla.org/en-US/docs/Web/API/Crypto.](https://developer.mozilla.org/en-US/docs/Web/API/Crypto.)

Inside the Crypto API, you’ll find the `randomUUID()` function, which generates a **UUID v4**.

Using it is very straightforward:

```javascript
import { randomUUID } from "crypto";

function main() {
  const id = randomUUID();
}
```

So, in the end, the choice depends on your project’s requirements.

For my backend REST API projects, I’ll replace the `uuid` dependency with the built-in `crypto.randomUUID()` API since I fully control the Node.js runtime version.

For frontend projects like **Next.js** or other browser-based applications, I’ll continue using the external `uuid` package because I can’t always guarantee that every user is running a modern browser that supports `crypto.randomUUID()`.
