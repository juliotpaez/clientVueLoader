# clientVueLoader
A front-end Vue loader based on [http-vue-loader](https://github.com/FranckFreiburger/http-vue-loader) of [Franck Freiburger](https://www.franck-freiburger.com/) with some changes to adapt it to my projects and last Vue improvements.

## Examples

TODO

## Features

*clientVueLoader* supports the same features than *http-vue-loader*:

- `<template>`, `<script>` and `<style>` support the `src` attribute.
- `module.exports` may be a promise.
- Support of relative urls in `<template>` and `<style>` sections.
- Support custom CSS, HTML and scripting languages, eg. `<script lang="coffee">`.

Plus:

- Custom tags and processors, eg. `<i18n local="en" lang="yaml">`.
- Scoped CSS styles in three additional ways:
    - Scoping just for the content of the Vue file, as the Vue's specification defines. Use the standard attribute: `<style scope>`.
    - Scoping the content of the Vue file and all its children, i.e. other imported components. Use a custom attribute: `<style scope-inside>`. NOTE: this is the *http-vue-loader* `scope` attribute equivalent.
    - The [CSS modules](https://vue-loader.vuejs.org/guide/css-modules.html). Use the standard attribute: `<style module>` or `<style module="name">`.
- A cache to not request repeatedly to the same contents.

## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png) | ![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png) | ![Safari](https://raw.github.com/alrra/browser-logos/master/src/safari/safari_48x48.png) | ![Opera](https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png) | ![Edge](https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png) |
--- | --- | --- | --- | --- |
Latest ✔ | Latest ✔ | ? | Latest ✔ | Latest ✔ |

## API

TODO