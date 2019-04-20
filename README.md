# clientVueLoader

A front-end Vue loader based on [http-vue-loader](https://github.com/FranckFreiburger/http-vue-loader) of [Franck Freiburger](https://www.franck-freiburger.com/) with some changes to adapt it to my projects and last Vue improvements.

## Examples

Import a component from another one:

```js
module.exports = {
    data() {
        return {};
    },
    components: {
        "sub-component": "url:component.vue"
    }
}
```

Add support for `<i18n>` tags. They can include the `module` tag to scope the translations to that component.

```js
// Compiler function for <i18n> tags.
clientVueLoader.registerCompileFunction("i18n", async function (context, result) {
    // Check the result of the pre-processor if there's any.
    if (result !== null) {
        if (!(result instanceof Object)) {
            throw new Error(
                `The returned value of the ${context.langAttribute} processor for the <i18n> tag must be an Object.`);
        }
    } else {
        result = JSON.parse(context.content);
    }

    const module = context.element.hasAttribute('module');
    if (module) {
        context.element.removeAttribute('module');

        // Add the uuid of the component as a prefix for every translation in this module.
        const newResult = {};
        for (let key in result) {
            const obj = result[key];
            if (!(obj instanceof Object)) {
                throw new Error(
                    `The first level of the root object of the <i18n> must be a collection of object. Wrong key: ${key}.\n${context.content}`);
            }

            newResult[key] = {
                [context.component.scopeId]: Object.assign({}, obj)
            }
        }
        result = newResult;
    }

    // Merge the results with the i18n languages.
    // TODO: depends on the implementation.
});

// Wrapper for the $t function of VueI18n to translate moduled i18n tags.
Vue.prototype.$jt = function (label, ...args) {
    const component = this.$data._component;
    label = component.scopeId + "." + label;   // Add the prefix for the component.

    return this.$t(label, ...args);
};
```

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

### Properties

- `clientVueLoader.urlPrefix` (`String` | `"url:"`): holds the prefix for those urls that must be resolved with *clientVueLoader*.
- `clientVueLoader.autoNameProperty` (`String` | `"cvl-auto-name"`): holds the name of the property inside components that must be an array with each url that should get its name from their filename. For example:
    ```js
    module.exports = {
        components: {
            "cvl-auto-name": ["component-a.vue", "component-b.vue", "component-c.vue"]
        }
    }

    // is equivalent to

    module.exports = {
        components: {
            "component-a": "url:component-a.vue",
            "component-b": "url:component-b.vue",
            "component-c": "url:component-c.vue",
        }
    }
    ```

### Methods

- `clientVueLoader.install(Vue)`

    Installs *clientVueLoader* inside the specified *Vue* instance.

- `clientVueLoader.clearCache()`

    Clears the cache of the loaded components by *clientVueLoader*.

- `clientVueLoader.registerLangProcessor(lang : String, processor : AsyncFuntion)`

    Registers a new language pre-processor for every tag. For example:

    ```js
    clientVueLoader.registerLangProcessor("json", async(text) => JSON.parse(text))
    ```

    Can be applied to any tag:

    ```html
    <script lang="json">
    {
        "tag": "value"
    }
    </script>
    ```

    > Inside the processor function, the value of `this` is the `TagContext` of the tag to process.

- `clientVueLoader.registerCompileFunction(tag : String, compiler : AsyncFuntion)`

    Registers a new compiler function for the specified tag. For example:

    ```js
    clientVueLoader.registerCompileFunction("i18n", i18nCompilerFunction)
    ```

    Allow to use i18n tags:

    ```html
    <i18n>
    {
        "en": {
            "spanish": "Spanish"
        },
        "es": {
            "spanish": "Español"
        }
    }
    </i18n>
    ```

    The compiler function receives two arguments:

    - `context` (`TagContext`): the tag to compile.
    - `result` (`Any`): the result of the pre-processor, if there's any, or `null`.

- `async clientVueLoader.load(url : String, name : String)`

    Loads a new component from `url` named as `name`. For example:

    ```js
    clientVueLoader.load("../component.vue", "my-component")
    ```

### Objects

- `TagContext`: the main container for a tag inside a component. Can be extended with custom properties.

    ```js
    {
        (get) tagName: String,      // The kebab-case name of the case. E.g. i18n, template...
        (get/set) content: String,  // The content of the tag.
        (get) firstChild: String,   // The first child of the tag.
    }
    ```

- `Component`: the main container for the component. Can be extended with custom properties.

    ```js
    {
        (get) head: DomNode,        // The head node of the DOM.
        (get) scopeId: String,      // A uuid for the component in the form: data-s-HEX
    }
    ```

> Only the documented methods and properties are meant as the public API. Use any other method on your own risk.