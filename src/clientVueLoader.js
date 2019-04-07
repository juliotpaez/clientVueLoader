/**
 * Made by Julio Treviño Páez
 */
(function umd(root, factory) {
    if (typeof module === 'object' && typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.clientVueLoader = factory();
    }
})(this, function factory() {
    'use strict';

    let scopeIndex = 0;
    const asyncFunctionPrototype = Object.getPrototypeOf(async function () {
    }).constructor;
    let cache = {};

    // Helper functions.
    let exportsHandler = async (a) => a;
    const langProcessor = {};
    const tagCompilers = {
        async template(context, result) {
            // Check the result of the pre-processor.
            if (result !== null) {
                if (typeof result !== 'string') {
                    throw new Error(`The returned value of the ${context.langAttribute} processor for the <template> tag must be String.`);
                }

                context.content = result;
            }

            // Check just for one root element.
            if (context.element.content.children.length === 0) {
                throw new Error(`The the <template> tag must have at least one root element.\n${context.content}`);
            } else if (context.element.content.children.length > 1) {
                throw new Error(`The the <template> tag must have just one root element.\n${context.content}`);
            }
        },
        async script(context, result) {
            // Check the result of the pre-processor.
            if (result !== null) {
                if (!(result instanceof Object)) {
                    throw new Error(`The returned value of the ${context.langAttribute} processor for the <script> tag must be an Object.`);
                }

                return result;
            }

            // Require function for the child module.
            const childModuleRequire = function (element) {
                return window[element];
            };

            // Require loader for the child module.
            const childLoader = async function (childURL, childName) {
                return VueComponent.createLoadFunction(new URL(childURL, context.component.url), childName)();
            };

            const module = {exports: {}};

            try {
                Function('exports', 'require', 'clientVueLoader', 'module', context.content).call(module.exports, module.exports, childModuleRequire, childLoader, module);
            } catch (ex) {
                // Check line number to show the error in a better way.
                if (!('lineNumber' in ex)) {
                    throw ex;
                }
                throw new Error(`${ex.message} at ${context.component.url}:${ex.lineNumber - 1}`);
            }

            // Check for promise.
            if (module.exports instanceof Promise) {
                await module.exports;
            }

            result = await exportsHandler(module.exports);
            if (!(result instanceof Object)) {
                throw new Error(`The value of the module.exports must be an Object.\n${context.component.content}`);
            }

            return result;
        },
        async style(context, result) {
            // Check the result of the pre-processor.
            if (result !== null) {
                if (typeof result !== 'string') {
                    throw new Error(`The returned value of the ${context.langAttribute} processor for the <template> tag must be String.`);

                }
                context.content = result;
            }


            // Get options.
            const hasTemplate = context.component.template !== null;
            const hasScript = context.component.script !== null;
            const scoped = context.element.hasAttribute('scoped');
            const scopedInside = context.element.hasAttribute('scoped-inside');
            const module = context.element.hasAttribute('module');

            if (scoped + scopedInside + module > 1) {
                throw new Error(`The <style> has more than one self-exclusive attribute: scoped, scoped-inside and module.\n ${context.content}`);
            }

            context.component.head.appendChild(context.element);

            if (scoped) {
                if (!hasTemplate) {
                    throw new Error(`The <style> has the scoped attribute but there is no <template> tag in the vue file.\n ${context.component.content}`);
                }

                context.element.removeAttribute('scoped');
                return scopeStyles(context, context.component.scopeId);
            } else if (scopedInside) {
                if (!hasTemplate) {
                    throw new Error(`The <style> has the scoped-inside attribute but there is no <template> tag in the vue file.\n ${context.component.content}`);
                }

                context.element.removeAttribute('scoped-inside');
                context.component.template.firstChild.setAttribute(context.component.scopeId, '');
                return scopeInsideStyles(context, context.component.scopeId);
            } else if (module) {
                if (!hasTemplate) {
                    throw new Error(`The <style> has the module attribute but there is no <template> tag in the vue file.\n ${context.component.content}`);
                }

                if (!hasScript) {
                    throw new Error(`The <style> has the module attribute but there is no <script> tag in the vue file.\n ${context.component.content}`);
                }

                let moduleName = context.element.getAttribute('module');
                moduleName = moduleName || "$style";

                context.component.hasModuleStyles = true;
                context.element.removeAttribute('module');
                return moduleStyles(context, moduleName, context.component.scopeId);
            }
        }
    };

    // Auxiliary functions for CSS --------------------------------------------
    const commaRegex = /\s*,\s*/;
    const segmentRegex = /([^ :]+)(.+)?/;
    const classRegex = /^(.*?)\.([\w-]+)(.*)$/;

    async function scopeStyles(context, customAttribute) {
        const cssAttribute = '[' + customAttribute + ']';

        function scopeRule(rule) {
            const scopedSelectors = [];

            rule.selectorText.split(commaRegex).forEach(function (sel) {
                const segments = sel.match(segmentRegex);
                let selector = segments[1] + cssAttribute;
                if (segments[2]) {
                    selector += segments[2] + cssAttribute;
                }
                selector.replace(":scope", cssAttribute);
                scopedSelectors.push(selector);
            });

            return scopedSelectors.join(',') + rule.cssText.substr(rule.selectorText.length);
        }

        const promises = [scopeCss(context, cssAttribute, scopeRule)];
        if (!context.component.template.alreadyScoped) {
            context.component.template.alreadyScoped = true;
            promises.push(scopeTemplate(context.component.template.firstChild, customAttribute));
        }

        return Promise.all(promises);
    }

    // Faster than scoped but with the caveat that its styles leak into its children.
    async function scopeInsideStyles(context, customAttribute) {
        const cssAttribute = '[' + customAttribute + ']';

        function scopeRule(rule) {
            const scopedSelectors = [];

            rule.selectorText.split(commaRegex).forEach(function (sel) {
                scopedSelectors.push(cssAttribute + ' ' + sel);
                const segments = sel.match(segmentRegex);
                scopedSelectors.push(segments[1] + cssAttribute + (segments[2] || ''));
            });

            return scopedSelectors.join(',') + rule.cssText.substr(rule.selectorText.length);
        }

        return scopeCss(context, cssAttribute, scopeRule);
    }

    async function moduleStyles(context, moduleName, customAttribute) {
        const cssAttribute = '[' + customAttribute + ']';
        const $style = {};

        function scopeRule(rule) {
            const scopedSelectors = [];

            rule.selectorText.split(commaRegex).forEach(function (selector) {
                function parseClass(selector) {
                    const match = selector.match(classRegex);
                    if (match) {
                        // Create the name if it is not yet created.
                        let newClass = $style[match[2]];
                        if (!newClass) {
                            newClass = $style[match[2]] = `${customAttribute}__${match[2]}`;
                        }

                        return match[1] + "." + newClass + parseClass(match[3]);
                    }

                    return selector;
                }

                scopedSelectors.push(parseClass(selector));
            });

            return scopedSelectors.join(',') + rule.cssText.substr(rule.selectorText.length);
        }

        await scopeCss(context, cssAttribute, scopeRule);

        // Assigns the styles to the data of the component.
        Object.freeze($style);
        if (!context.component.script) {
            throw new Error(`The <style module> tag cannot be compiled if there is no an <script> tag.\n${context.content}`);
        }

        return [moduleName, $style];
    }

    // Scopes the template tag adding the custom attribute.
    async function scopeTemplate(current, customAttribute) {
        current.setAttribute(customAttribute, "");
        for (let i = 0; i < current.children.length; i++) {
            let child = current.children[i];
            await scopeTemplate(child, customAttribute);
        }
    }

    // Scopes the style tag adding parsing its rules.
    async function scopeCss(context, cssAttribute, scopeRuleFunction) {
        const sheet = context.element.sheet;
        const rules = sheet.cssRules;

        for (let i = 0; i < rules.length; ++i) {
            const rule = rules[i];

            if (rule.type === 1) {
                sheet.insertRule(scopeRuleFunction(rule, cssAttribute), i);
                sheet.deleteRule(i + 1);
            } else if (rule.type === 4) {
                let tmpScopedMedia = "";

                for (let j = 0; j < rule.cssRules.length; ++j) {
                    const mediaRule = rule.cssRules[j];
                    if (mediaRule.type === 1) {
                        tmpScopedMedia += scopeRuleFunction(mediaRule, cssAttribute);
                    }
                }

                const mediaScoped = "@media " + rule.conditionText + "{" + tmpScopedMedia + "}";

                sheet.insertRule(mediaScoped, i);
                sheet.deleteRule(i + 1);
            }
        }
    }

    class TagContext {
        constructor(component, element) {
            this.component = component;
            this.element = element;
            this.result = null;

            if (this.element.hasAttribute("src")) {
                this.srcAttribute = this.element.getAttribute("src");
                this.element.removeAttribute('src');
            } else {
                this.srcAttribute = null;
            }

            if (this.element.hasAttribute("lang")) {
                this.langAttribute = this.element.getAttribute("lang");
                this.element.removeAttribute('lang');
            } else {
                this.langAttribute = null;
            }
        }

        // Getters ------------------------------------------------------------

        get tagName() {
            return this.element.nodeName.toLowerCase();
        }

        get content() {
            return this.element.innerHTML;
        }

        get firstChild() {
            const element = this.element.content || this.element;
            return element.children[0];
        }

        // Setters ------------------------------------------------------------

        set content(value) {
            this.element.innerHTML = value;
        }

        // Methods ------------------------------------------------------------

        // Normalize this tag loading its content from the src attribute.
        async normalize() {
            if (this.srcAttribute) {
                this.content = await VueComponent.httpRequest(new URL(this.srcAttribute, this.component.url));
            }
        }

        // Compiles the template, applying the language, specified in the lang attribute, to its content.
        async compile() {
            const compiler = tagCompilers[this.tagName];
            if (!compiler) {
                throw new Error(`There isn't a compiler for tag <${this.tagName}>\n${this.element.outerHTML}`)
            }

            // Executes the language pre-processor.
            let result = null;
            if (this.langAttribute !== null) {
                result = await VueComponent.langProcessor[this.langAttribute].call(this);
            }

            this.result = await compiler(this, result);
        }
    }

    class Component {
        constructor(name, url) {
            this.name = name;
            this.url = url;
            this.content = null;
            this.moduleStyles = null;
            this.exports = null;
            this._scopeId = null;

            // Required at least a template or a script, any other combination is optional.
            this.template = null;
            this.script = null;
            this.tags = {};
        }

        // Getters ------------------------------------------------------------

        // Gets the head of this document.
        get head() {
            return document.head || document.getElementsByTagName('head')[0];
        }

        // Lazily gets the scope id for this component.
        get scopeId() {
            if (this._scopeId === null) {
                this._scopeId = 'data-s-' + (scopeIndex++).toString(36);
            }

            return this._scopeId;
        }

        // Methods ------------------------------------------------------------

        // Inserts a tag in the component.
        addTag(tagContext) {
            const tagName = tagContext.tagName;
            this.tags[tagName] = this.tags[tagName] || [];
            this.tags[tagName].push(tagContext);
        }

        // Loads the component from its url.
        async load() {
            this.content = await VueComponent.httpRequest(this.url);

            const doc = document.implementation.createHTMLDocument('');

            // IE requires the <base> to come with <style>
            doc.head.innerHTML += `<base href="${this.url}">`;
            doc.body.innerHTML = this.content;

            // NOTE: skip the base node.
            for (let i = 0; i < doc.body.children.length; i++) {
                let element = doc.body.children[i];
                switch (element.nodeName) {
                    case 'TEMPLATE':
                        if (this.template) {
                            throw new Error(`Duplicated <template> tag at url(${this.url})\n${this.content}`);
                        }

                        this.template = new TagContext(this, element);
                        this.addTag(this.template);
                        break;
                    case 'SCRIPT':
                        if (this.script) {
                            throw new Error(`Duplicated <script> tag at url(${this.url})\n${this.content}`);
                        }

                        this.script = new TagContext(this, element);
                        this.addTag(this.script);
                        break;
                    default:
                        this.addTag(new TagContext(this, element));
                        break;
                }
            }

            if (this.template || this.script) {
                return this;
            }

            throw new Error(`There isn't a template or a script tag in the loaded vue document at url(${this.url})\n${responseText}`);
        }

        // Normalize all tags loading their content from the src attribute.
        async normalize() {
            const normalizations = [];

            for (let tagName in this.tags) {
                for (let tag of this.tags[tagName]) {
                    normalizations.push(tag.normalize());
                }
            }

            await Promise.all(normalizations);
        }

        // Compiles all the tags to create the vue component.
        async compile() {
            const compilations = [];

            // Ensure the order: script ...
            if (this.script) {
                await this.script.compile();
            }

            for (let tagName in this.tags) {
                if (tagName === "script") {
                    continue;
                }

                for (let tag of this.tags[tagName]) {
                    compilations.push(tag.compile());
                }
            }

            await Promise.all(compilations);

            // Merge style results.
            if (this.tags["style"]) {
                const styles = {};
                for (let tagContext of this.tags["style"]) {
                    if (tagContext.result) {
                        const [tag, value] = tagContext.result;
                        if (styles[tag]) {
                            Object.assign(styles[tag], value);
                        } else {
                            styles[tag] = value;
                        }
                    }
                }

                // Freeze the object to be read only.
                for (let element in styles) {
                    Object.freeze(styles[element]);
                }

                this.moduleStyles = styles;
            }
        }
    }

    class VueComponent {
        constructor() {
            this.urlPrefix = "cvl:";
            this.autoNameProperty = "cvl-auto-name";
            this.pathRegex = /\/([a-zA-Z_][a-zA-Z_0-9]*(?:"-"?[a-zA-Z_0-9]+)*?)(?:\.[^\.]+)?$/
        }

        // Methods ------------------------------------------------------------
        install(Vue) {
            const that = this;

            Vue.mixin({
                // Detect (url:...) like patterns.
                created() {
                    const components = this.$options.components;
                    const autoNamedComponents = {};
                    const rootUrl = this.$options._baseUrl ? this.$options._baseUrl : document.URL;

                    // Parse auto named components.
                    if (components[that.autoNameProperty]) {
                        const urls = components[that.autoNameProperty];

                        if (!(urls instanceof Array)) {
                            throw new Error(`The ${that.autoNameProperty} property of components should be an array of Strings.`);
                        }

                        for (let url of urls) {
                            if (typeof (url) !== 'string') {
                                throw new Error(`The ${that.autoNameProperty} property of components should be an array of Strings.`);
                            }

                            const componentURL = new URL(url, rootUrl);
                            const matches = componentURL.pathname.match(that.pathRegex);
                            if (matches === null) {
                                throw new Error(`The URL(${componentURL.pathname}) has not a correct name to set for an auto-component.`);
                            }

                            if (components[matches[1]]) {
                                throw new Error(`There is already a component by name ${matches[1]}.`);
                            }

                            autoNamedComponents[matches[1]] = Vue.component(matches[1], VueComponent.createLoadFunction(componentURL, matches[1]));
                        }
                    }
                    delete components[that.autoNameProperty];

                    // Parse the rest components.
                    for (let componentName in components) {
                        const component = components[componentName];
                        if (typeof (component) === 'string' && component.startsWith(that.urlPrefix)) {
                            const componentURL = new URL(component.substr(4), rootUrl);
                            components[componentName] = VueComponent.createLoadFunction(componentURL, componentName);
                        }
                    }

                    // Copy auto named components.
                    Object.assign(components, autoNamedComponents);
                }
            });
        }

        // Registers a custom processor for a language.
        clearCache() {
            cache = {};
        }

        // Registers a custom processor for a language.
        registerLangProcessor(lang, processor) {
            if (!(processor instanceof Function)) {
                throw new Error("The language processor must be a function.");
            }

            langProcessor[lang] = processor;
        }

        // Registers a compile function for a html tag.
        registerCompileFunction(tag, compiler) {
            if (!(compiler instanceof Function)) {
                throw new Error("The compiler must be a function.");
            }

            tagCompilers[tag] = compiler;
        }

        // Registers a function that will check the exports for every component.
        registerExportsHandler(handler) {
            if (!(handler instanceof asyncFunctionPrototype)) {
                throw new Error("The compiler must be a function.");
            }

            exportsHandler = handler;
        }

        // Loads an element.
        async load(url, name) {

            return VueComponent.createLoadFunction(new URL(url), name)();

        }

        // Creates a load function that will be called whenever Vue needs the component.
        static createLoadFunction(url, name) {
            return async function () {
                try {
                    let component = cache[url]; // Check the cache.
                    if (!component) {
                        component = new Component(name, url);
                        await component.load();
                        await component.normalize();
                        await component.compile();

                        const exports = component.exports = component.script !== null ? component.script.result : {};

                        // Set the templates.
                        if (component.template !== null) {
                            if (exports.template) {
                                throw new Error("There is already a template function or string in module.exports that collides with the template tag (<template>) defined in the vue component.");
                            }
                            exports.template = component.template.content;
                        }

                        // Set the name of the component.
                        if (exports.name === undefined) {
                            exports.name = component.name;
                        }

                        // Proxies the beforeCreate event of the component to fill the new data.
                        const prevBeforeCreate = exports.beforeCreate;
                        exports.beforeCreate = function () {
                            // Add base url.
                            this.$options._baseUrl = component.url;
                            return (prevBeforeCreate instanceof Function) ? prevBeforeCreate.bind(this)() : prevBeforeCreate;
                        };

                        const prevCreated = exports.created;
                        exports.created = function () {
                            // Set styles for css modules.
                            if (component.moduleStyles) {
                                // We have to trick Vue to let us add the reactive properties.
                                const save = this.$data.__ob__.vmCount;
                                this.$data.__ob__.vmCount = null;

                                for (let style in component.moduleStyles) {
                                    Vue.set(this.$data, style, component.moduleStyles[style]);
                                    // Add the proxy to use prop instead of $data.prop
                                    Object.defineProperty(this, style, {
                                        enumerable: true,
                                        configurable: true,
                                        get: function proxyGetter() {
                                            return this.$data[style]
                                        },
                                        set: function proxySetter(val) {
                                            this.$data[style] = val;
                                        }
                                    });
                                }

                                this.$data.__ob__.vmCount = save;
                            }

                            return (prevCreated instanceof Function) ? prevCreated.bind(this)() : prevCreated;
                        };

                        // Cache the result.
                        cache[url] = component;
                    }

                    return component.exports;
                } catch (ex) {
                    console.error(ex);
                    throw ex;
                }
            };
        }

        // Performs an http get request.
        static async httpRequest(url) {
            return new Promise(function (resolve) {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(xhr.responseText);
                        } else {
                            throw new Error("[error] Cannot load " + url);
                        }
                    }
                };

                xhr.send(null);
            });
        };
    }

    return new VueComponent();
});
