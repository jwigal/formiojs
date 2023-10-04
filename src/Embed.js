import CDN from './CDN.js';
export class Formio {
    static FormioClass = null;
    static baseUrl;
    static projectUrl;
    static pathType;
    static language;
    static config = {};
    static cdn;
    static modules = [];
    static icons = '';
    static license = '';
    static formioReady = new Promise((ready, reject) => {
        Formio._formioReady = ready;
        Formio._formioReadyReject = reject;
    });
    static version = 'FORMIO_VERSION';
    static setLicense(license, norecurse = false) {
        Formio.license = license;
        if (!norecurse && Formio.FormioClass) {
            Formio.FormioClass.setLicense(license);
        }
    }

    static setBaseUrl(url, norecurse = false) {
        Formio.baseUrl = url;
        if (!norecurse && Formio.FormioClass) {
            Formio.FormioClass.setBaseUrl(url);
        }
    }

    static setApiUrl(url, norecurse = false) {
        Formio.baseUrl = url;
        if (!norecurse && Formio.FormioClass) {
            Formio.FormioClass.setApiUrl(url);
        }
    }

    static setProjectUrl(url, norecurse = false) {
        Formio.projectUrl = url;
        if (!norecurse && Formio.FormioClass) {
            Formio.FormioClass.setProjectUrl(url);
        }
    }

    static setAppUrl(url, norecurse = false) {
        Formio.projectUrl = url;
        if (!norecurse && Formio.FormioClass) {
            Formio.FormioClass.setAppUrl(url);
        }
    }

    static setPathType(type, norecurse = false) {
        Formio.pathType = type;
        if (!norecurse && Formio.FormioClass) {
            Formio.FormioClass.setPathType(type);
        }
    }

    static debug(...args) {
        if (Formio.config.debug) {
            console.log(...args);
        }
    }

    static clearCache() {
        if (Formio.FormioClass) {
            Formio.FormioClass.clearCache();
        }
    }

    static global(prop, flag = '') {
        const globalValue = window[prop];
        if (flag && globalValue && !globalValue[flag]) {
            return null;
        }
        Formio.debug(`Getting global ${prop}`, globalValue);
        return globalValue;
    }

    static use(module) {
        if (Formio.FormioClass && Formio.FormioClass.isRenderer) {
            Formio.FormioClass.use(module);
        }
        else {
            Formio.modules.push(module);
        }
    }

    static createElement(type, attrs, children) {
        const element = document.createElement(type);
        Object.keys(attrs).forEach(key => {
            element.setAttribute(key, attrs[key]);
        });
        (children || []).forEach(child => {
            element.appendChild(Formio.createElement(child.tag, child.attrs, child.children));
        });
        return element;
    }

    static async addScript(wrapper, src, name, flag = '') {
        if (!src) {
            return Promise.resolve();
        }
        if (typeof src !== 'string' && src.length) {
            return Promise.all(src.map(ref => Formio.addScript(wrapper, ref)));
        }
        if (name && Formio.global(name, flag)) {
            Formio.debug(`${name} already loaded.`);
            return Promise.resolve(Formio.global(name));
        }
        Formio.debug('Adding Script', src);
        try {
            wrapper.appendChild(Formio.createElement('script', {
                src
            }));
        }
        catch (err) {
            Formio.debug(err);
            return Promise.resolve();
        }
        if (!name) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            Formio.debug(`Waiting to load ${name}`);
            const wait = setInterval(() => {
                if (Formio.global(name, flag)) {
                    clearInterval(wait);
                    Formio.debug(`${name} loaded.`);
                    resolve(Formio.global(name));
                }
            }, 100);
        });
    }

    static async addStyles(wrapper, href) {
        if (!href) {
            return;
        }
        if (typeof href !== 'string' && href.length) {
            href.forEach(ref => Formio.addStyles(wrapper, ref));
            return;
        }
        Formio.debug('Adding Styles', href);
        wrapper.appendChild(Formio.createElement('link', {
            rel: 'stylesheet',
            href
        }));
    }

    static async submitDone(instance, submission) {
        Formio.debug('Submision Complete', submission);
        const successMessage = (Formio.config.success || '').toString();
        if (successMessage && successMessage.toLowerCase() !== 'false' && instance.element) {
            instance.element.innerHTML = `<div class="alert-success" role="alert">${successMessage}</div>`;
        }
        let returnUrl = Formio.config.redirect;

        // Allow form based configuration for return url.
        if (
            !returnUrl &&
            (
                instance._form &&
                instance._form.settings &&
                (
                    instance._form.settings.returnUrl ||
                    instance._form.settings.redirect
                )
            )
        ) {
            Formio.debug('Return url found in form configuration');
            returnUrl = instance._form.settings.returnUrl || instance._form.settings.redirect;
        }

        if (returnUrl) {
            const formSrc = instance.formio ? instance.formio.formUrl : '';
            const hasQuery = !!returnUrl.match(/\?/);
            const isOrigin = returnUrl.indexOf(location.origin) === 0;
            returnUrl += hasQuery ? '&' : '?';
            returnUrl += `sub=${submission._id}`;
            if (!isOrigin && formSrc) {
                returnUrl += `&form=${encodeURIComponent(formSrc)}`;
            }
            Formio.debug('Return URL', returnUrl);
            window.location.href = returnUrl;
            if (isOrigin) {
                window.location.reload();
            }
        }
    }

    // Return the full script if the builder is being used.
    static formioScript(script, builder) {
        builder = builder || Formio.config.includeBuilder;
        if (Formio.fullAdded || builder) {
            Formio.fullAdded = true;
            return script.replace('formio.form', 'formio.full');
        }
        return script;
    }

    // eslint-disable-next-line max-statements
    static async init(element, options = {}, builder = false) {
        Formio.cdn = new CDN(Formio.config.cdn, Formio.config.cdnUrls || {});
        Formio.config.libs = Formio.config.libs || {
            uswds: {
                fa: true,
                js: `${Formio.cdn.uswds}/uswds.min.js`,
                css: `${Formio.cdn.uswds}/uswds.min.css`,
            },
            fontawesome: {
                css: `${Formio.cdn['font-awesome']}/css/font-awesome.min.css`
            },
            bootstrap: {
                css: `${Formio.cdn.bootstrap}/css/bootstrap.min.css`
            }
        };
        const id = Formio.config.id || `formio-${Math.random().toString(36).substring(7)}`;

        // Create a new wrapper and add the element inside of a new wrapper.
        let wrapper = Formio.createElement('div', {
            'id': `${id}-wrapper`
        });
        element.parentNode.insertBefore(wrapper, element);

        // If we include the libraries, then we will attempt to run this in shadow dom.
        if (Formio.config.includeLibs && (typeof wrapper.attachShadow === 'function') && !Formio.config.premium) {
            wrapper = wrapper.attachShadow({
                mode: 'open'
            });
            options.shadowRoot = wrapper;
        }

        element.parentNode.removeChild(element);
        wrapper.appendChild(element);

        // Load the renderer styles.
        await Formio.addStyles(wrapper, Formio.config.embedCSS || `${Formio.cdn.js}/formio.embed.css`);

        // Add a loader.
        wrapper.appendChild(Formio.createElement('div', {
            'class': 'formio-loader'
        }, [{
            tag: 'div',
            attrs: {
                class: 'loader-wrapper'
            },
            children: [{
                tag: 'div',
                attrs: {
                    class: 'loader text-center'
                }
            }]
        }]));

        const renderer = Formio.config.debug ? 'formio.form' : 'formio.form.min';
        Formio.FormioClass = await Formio.addScript(
            wrapper,
            Formio.formioScript(Formio.config.script || `${Formio.cdn.js}/${renderer}.js`, builder),
            'Formio',
            builder ? 'isBuilder' : 'isRenderer'
        );
        Formio.FormioClass.cdn = Formio.cdn;
        Formio.FormioClass.setBaseUrl(options.baseUrl || Formio.baseUrl || Formio.config.base);
        Formio.FormioClass.setProjectUrl(options.projectUrl || Formio.projectUrl || Formio.config.project);
        Formio.FormioClass.language = Formio.language;
        Formio.setLicense(Formio.license || Formio.config.license || false);
        Formio.modules.forEach((module) => {
            Formio.FormioClass.use(module);
        });

        if (Formio.icons) {
            Formio.FormioClass.icons = Formio.icons;
        }

        if (Formio.pathType) {
            Formio.FormioClass.setPathType(Formio.pathType);
        }

        if (Formio.config.template) {
            if (Formio.config.includeLibs) {
                await Formio.addStyles(wrapper, Formio.config.libs[Formio.config.template].css);
                await Formio.addScript(wrapper, Formio.config.libs[Formio.config.template].js);
                if (Formio.config.libs[Formio.config.template].fa) {
                    await Formio.addStyles(wrapper, Formio.config.libs.fontawesome.css);
                }
            }

            if (Formio.cdn[Formio.config.template]) {
                const templateSrc = `${Formio.cdn[Formio.config.template]}/${Formio.config.template}.min`;
                await Formio.addStyles(wrapper, `${templateSrc}.css`);
                Formio.debug(`Using ${Formio.config.template}`);
                Formio.FormioClass.use(await Formio.addScript(wrapper, `${templateSrc}.js`, Formio.config.template));
            }
        }
        // Default bootstrap + fontawesome.
        else if (Formio.config.includeLibs) {
            await Formio.addStyles(wrapper, Formio.config.libs.fontawesome.css);
            await Formio.addStyles(wrapper, Formio.config.libs.bootstrap.css);
        }

        // Allow dynamic adding of modules.
        if (Formio.config.modules) {
            for (const name in Formio.config.modules) {
                const moduleInfo = Formio.config.modules[name];
                await Formio.addStyles(wrapper, moduleInfo.css);
                const module = await Formio.addScript(wrapper, moduleInfo.js, name);
                const options = moduleInfo.options || {};
                if (!options.license && Formio.license) {
                    options.license = Formio.license;
                }
                if (moduleInfo.use) {
                    Formio.FormioClass.use(moduleInfo.use(module), options);
                }
                else {
                    Formio.FormioClass.use(module, options);
                }
            }
        }

        if (Formio.config.premium) {
            await Formio.addStyles(wrapper, Formio.config.premium.css);
            Formio.debug('Using premium');
            Formio.FormioClass.use(await Formio.addScript(wrapper, Formio.config.premium.js, 'premium'));
        }

        await Formio.addStyles(wrapper, Formio.formioScript(Formio.config.style || `${Formio.cdn.js}/${renderer}.css`, builder));
        if (Formio.config.before) {
            await Formio.config.before(Formio.FormioClass, element, Formio.config);
        }
        Formio.FormioClass.license = true;
        Formio._formioReady(Formio.FormioClass);
        return wrapper;
    }

    static async createForm(element, form, options = {}) {
        const wrapper = await Formio.init(element, options);
        return Formio.FormioClass.createForm(element, form, {
            ...options,
            ...{ noLoader: true }
        }).then((instance) => {
            Formio.debug('Form created', instance);

            // Remove the loader.
            Formio.debug('Removing loader');
            wrapper.removeChild(wrapper.querySelector('.formio-loader'));

            // Set the default submission data.
            if (Formio.config.submission) {
                Formio.debug('Setting submission', Formio.config.submission);
                instance.submission = Formio.config.submission;
            }

            // Allow them to provide additional configs.
            Formio.debug('Triggering embed event');
            Formio.FormioClass.events.emit('formEmbedded', instance);

            // Trigger the after handler.
            if (Formio.config.after) {
                Formio.debug('Calling ready callback');
                Formio.config.after(instance, Formio.config);
            }

            return instance;
        });
    }

    static async builder(element, form, options = {}) {
        const wrapper = await Formio.init(element, options, true);
        return Formio.FormioClass.builder(element, form, options).then((instance) => {
            Formio.debug('Builder created', instance);
            Formio.debug('Removing loader');
            wrapper.removeChild(wrapper.querySelector('.formio-loader'));
            Formio.debug('Triggering embed event');
            Formio.FormioClass.events.emit('builderEmbedded', instance);
            if (Formio.config.after) {
                Formio.debug('Calling ready callback');
                Formio.config.after(instance, Formio.config);
            }
            return instance;
        });
    }

    static Report = {
        create: async(element, submission, options = {}) => {
            const wrapper = await Formio.init(element, options, true);
            return Formio.FormioClass.Report.create(element, submission, options).then((instance) => {
                Formio.debug('Report created', instance);
                Formio.debug('Removing loader');
                wrapper.removeChild(wrapper.querySelector('.formio-loader'));
                Formio.debug('Triggering embed event');
                Formio.FormioClass.events.emit('reportEmbedded', instance);
                return instance;
            });
        }
    };
}

CDN.defaultCDN = Formio.version.includes('rc') ? 'https://cdn.test-form.io' : 'https://cdn.form.io';

export class Form {
    constructor(element, form, options) {
        this.form = form;
        this.element = element;
        this.options = options || {};
        this.init();
        this.instance = {
            proxy: true,
            ready: this.ready,
            destroy: () => {}
        };
    }

    init() {
        this.element.innerHTML = '';
        this.ready = this.create().then((instance) => {
            this.instance = instance;
            this.form = instance.form;
            return instance;
        });
    }

    create() {
        return Formio.createForm(this.element, this.form, this.options);
    }

    setDisplay(display) {
        if (this.instance.proxy) {
            return this.ready;
        }
        this.form.display = display;
        this.init();
        return this.ready;
    }
}

export class FormBuilder extends Form {
    create() {
        return Formio.builder(this.element, this.form, this.options);
    }
}

Formio.Form = Form;
Formio.FormBuilder = FormBuilder;
