var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.35.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* components/Auth.svelte generated by Svelte v3.35.0 */

    const { console: console_1 } = globals;
    const file = "components/Auth.svelte";

    function create_fragment(ctx) {
    	let div1;
    	let h1;
    	let t1;
    	let form;
    	let input0;
    	let t2;
    	let input1;
    	let t3;
    	let input2;
    	let t4;
    	let div0;
    	let t5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Create an account";
    			t1 = space();
    			form = element("form");
    			input0 = element("input");
    			t2 = space();
    			input1 = element("input");
    			t3 = space();
    			input2 = element("input");
    			t4 = space();
    			div0 = element("div");
    			t5 = text(/*error*/ ctx[2]);
    			add_location(h1, file, 20, 2, 410);
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "Username");
    			add_location(input0, file, 22, 4, 492);
    			attr_dev(input1, "type", "password");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "Password");
    			add_location(input1, file, 23, 4, 572);
    			attr_dev(input2, "type", "submit");
    			input2.value = "Create an account";
    			add_location(input2, file, 29, 4, 684);
    			attr_dev(form, "id", "signup-form");
    			add_location(form, file, 21, 2, 439);
    			attr_dev(div0, "id", "signup-error");
    			attr_dev(div0, "class", "svelte-2j1inj");
    			add_location(div0, file, 31, 2, 746);
    			attr_dev(div1, "id", "auth-view");
    			attr_dev(div1, "class", "svelte-2j1inj");
    			add_location(div1, file, 19, 0, 387);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, form);
    			append_dev(form, input0);
    			set_input_value(input0, /*username*/ ctx[0]);
    			append_dev(form, t2);
    			append_dev(form, input1);
    			set_input_value(input1, /*password*/ ctx[1]);
    			append_dev(form, t3);
    			append_dev(form, input2);
    			append_dev(div1, t4);
    			append_dev(div1, div0);
    			append_dev(div0, t5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(form, "submit", /*handleSignUp*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
    				set_input_value(input0, /*username*/ ctx[0]);
    			}

    			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
    				set_input_value(input1, /*password*/ ctx[1]);
    			}

    			if (dirty & /*error*/ 4) set_data_dev(t5, /*error*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Auth", slots, []);
    	let username = "";
    	let password = "";
    	let error = "";
    	let { isLoggedIn } = $$props;

    	function handleSignUp(e) {
    		e.preventDefault();

    		userbase.signUp({ username, password, rememberMe: "local" }).then(user => {
    			console.log("Logged in!");
    			$$invalidate(4, isLoggedIn = true);
    		}).catch(errorFromApi => $$invalidate(2, error = errorFromApi));
    	}

    	const writable_props = ["isLoggedIn"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Auth> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		username = this.value;
    		$$invalidate(0, username);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	$$self.$$set = $$props => {
    		if ("isLoggedIn" in $$props) $$invalidate(4, isLoggedIn = $$props.isLoggedIn);
    	};

    	$$self.$capture_state = () => ({
    		username,
    		password,
    		error,
    		isLoggedIn,
    		handleSignUp
    	});

    	$$self.$inject_state = $$props => {
    		if ("username" in $$props) $$invalidate(0, username = $$props.username);
    		if ("password" in $$props) $$invalidate(1, password = $$props.password);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    		if ("isLoggedIn" in $$props) $$invalidate(4, isLoggedIn = $$props.isLoggedIn);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		username,
    		password,
    		error,
    		handleSignUp,
    		isLoggedIn,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Auth extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { isLoggedIn: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Auth",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isLoggedIn*/ ctx[4] === undefined && !("isLoggedIn" in props)) {
    			console_1.warn("<Auth> was created without expected prop 'isLoggedIn'");
    		}
    	}

    	get isLoggedIn() {
    		throw new Error("<Auth>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isLoggedIn(value) {
    		throw new Error("<Auth>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/Login.svelte generated by Svelte v3.35.0 */

    const { console: console_1$1 } = globals;
    const file$1 = "components/Login.svelte";

    function create_fragment$1(ctx) {
    	let h1;
    	let t1;
    	let form;
    	let input0;
    	let t2;
    	let input1;
    	let t3;
    	let input2;
    	let t4;
    	let div;
    	let t5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Login";
    			t1 = space();
    			form = element("form");
    			input0 = element("input");
    			t2 = space();
    			input1 = element("input");
    			t3 = space();
    			input2 = element("input");
    			t4 = space();
    			div = element("div");
    			t5 = text(/*error*/ ctx[2]);
    			add_location(h1, file$1, 19, 0, 386);
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "Username");
    			add_location(input0, file$1, 21, 2, 450);
    			attr_dev(input1, "type", "password");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "Password");
    			add_location(input1, file$1, 22, 2, 528);
    			attr_dev(input2, "type", "submit");
    			input2.value = "Sign in";
    			add_location(input2, file$1, 28, 2, 628);
    			attr_dev(form, "id", "login-form");
    			add_location(form, file$1, 20, 0, 401);
    			attr_dev(div, "id", "login-error");
    			add_location(div, file$1, 30, 0, 676);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, form, anchor);
    			append_dev(form, input0);
    			set_input_value(input0, /*username*/ ctx[0]);
    			append_dev(form, t2);
    			append_dev(form, input1);
    			set_input_value(input1, /*password*/ ctx[1]);
    			append_dev(form, t3);
    			append_dev(form, input2);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, t5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(form, "submit", /*handleLogin*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
    				set_input_value(input0, /*username*/ ctx[0]);
    			}

    			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
    				set_input_value(input1, /*password*/ ctx[1]);
    			}

    			if (dirty & /*error*/ 4) set_data_dev(t5, /*error*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(form);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Login", slots, []);
    	let { isLoggedIn } = $$props;
    	let username = "";
    	let password = "";
    	let error = "";

    	function handleLogin(e) {
    		e.preventDefault();

    		userbase.signIn({ username, password, rememberMe: "local" }).then(user => {
    			console.log("Logged in!");
    			$$invalidate(4, isLoggedIn = true);
    		}).catch(errorFromApi => $$invalidate(2, error = errorFromApi));
    	}

    	const writable_props = ["isLoggedIn"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		username = this.value;
    		$$invalidate(0, username);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	$$self.$$set = $$props => {
    		if ("isLoggedIn" in $$props) $$invalidate(4, isLoggedIn = $$props.isLoggedIn);
    	};

    	$$self.$capture_state = () => ({
    		isLoggedIn,
    		username,
    		password,
    		error,
    		handleLogin
    	});

    	$$self.$inject_state = $$props => {
    		if ("isLoggedIn" in $$props) $$invalidate(4, isLoggedIn = $$props.isLoggedIn);
    		if ("username" in $$props) $$invalidate(0, username = $$props.username);
    		if ("password" in $$props) $$invalidate(1, password = $$props.password);
    		if ("error" in $$props) $$invalidate(2, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		username,
    		password,
    		error,
    		handleLogin,
    		isLoggedIn,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { isLoggedIn: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isLoggedIn*/ ctx[4] === undefined && !("isLoggedIn" in props)) {
    			console_1$1.warn("<Login> was created without expected prop 'isLoggedIn'");
    		}
    	}

    	get isLoggedIn() {
    		throw new Error("<Login>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isLoggedIn(value) {
    		throw new Error("<Login>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/Button.svelte generated by Svelte v3.35.0 */

    const file$2 = "components/Button.svelte";

    function create_fragment$2(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr_dev(button, "style", /*style*/ ctx[0]);
    			add_location(button, file$2, 4, 0, 40);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*style*/ 1) {
    				attr_dev(button, "style", /*style*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Button", slots, ['default']);
    	let { style } = $$props;
    	const writable_props = ["style"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ("style" in $$props) $$invalidate(0, style = $$props.style);
    		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ style });

    	$$self.$inject_state = $$props => {
    		if ("style" in $$props) $$invalidate(0, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [style, $$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { style: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*style*/ ctx[0] === undefined && !("style" in props)) {
    			console.warn("<Button> was created without expected prop 'style'");
    		}
    	}

    	get style() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/FeedbackItem.svelte generated by Svelte v3.35.0 */

    const file$3 = "components/FeedbackItem.svelte";

    function create_fragment$3(ctx) {
    	let li;
    	let t_value = /*item*/ ctx[0].item.feedback + "";
    	let t;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			attr_dev(li, "class", "svelte-ddcgrv");
    			add_location(li, file$3, 4, 0, 39);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*item*/ 1 && t_value !== (t_value = /*item*/ ctx[0].item.feedback + "")) set_data_dev(t, t_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("FeedbackItem", slots, []);
    	let { item } = $$props;
    	const writable_props = ["item"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<FeedbackItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    	};

    	$$self.$capture_state = () => ({ item });

    	$$self.$inject_state = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [item];
    }

    class FeedbackItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { item: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FeedbackItem",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*item*/ ctx[0] === undefined && !("item" in props)) {
    			console.warn("<FeedbackItem> was created without expected prop 'item'");
    		}
    	}

    	get item() {
    		throw new Error("<FeedbackItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<FeedbackItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/DisplayFeedback.svelte generated by Svelte v3.35.0 */

    const { console: console_1$2 } = globals;
    const file$4 = "components/DisplayFeedback.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (17:0) {#if items}
    function create_if_block(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*items*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*items*/ 1) {
    				each_value = /*items*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(17:0) {#if items}",
    		ctx
    	});

    	return block;
    }

    // (18:2) {#each items as item}
    function create_each_block(ctx) {
    	let ul;
    	let feedbackitem;
    	let t;
    	let current;

    	feedbackitem = new FeedbackItem({
    			props: { item: /*item*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			create_component(feedbackitem.$$.fragment);
    			t = space();
    			attr_dev(ul, "class", "svelte-17xb674");
    			add_location(ul, file$4, 18, 4, 313);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);
    			mount_component(feedbackitem, ul, null);
    			append_dev(ul, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const feedbackitem_changes = {};
    			if (dirty & /*items*/ 1) feedbackitem_changes.item = /*item*/ ctx[1];
    			feedbackitem.$set(feedbackitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(feedbackitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(feedbackitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_component(feedbackitem);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(18:2) {#each items as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let h1;
    	let t1;
    	let if_block_anchor;
    	let current;
    	let if_block = /*items*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "To-Do List";
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			add_location(h1, file$4, 15, 0, 253);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*items*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*items*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("DisplayFeedback", slots, []);
    	let items;

    	userbase.openDatabase({
    		databaseName: "public-feedback",
    		changeHandler: itemsFromApi => $$invalidate(0, items = itemsFromApi)
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<DisplayFeedback> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ FeedbackItem, items });

    	$$self.$inject_state = $$props => {
    		if ("items" in $$props) $$invalidate(0, items = $$props.items);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*items*/ 1) {
    			 {
    				console.log(items);
    			}
    		}
    	};

    	return [items];
    }

    class DisplayFeedback extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DisplayFeedback",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* components/AddFeedback.svelte generated by Svelte v3.35.0 */

    const { console: console_1$3 } = globals;
    const file$5 = "components/AddFeedback.svelte";

    // (49:0) {#if error !== ''}
    function create_if_block$1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(/*error*/ ctx[0]);
    			add_location(div, file$5, 49, 2, 1293);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 1) set_data_dev(t, /*error*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(49:0) {#if error !== ''}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let form;
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let input2;
    	let t2;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*error*/ ctx[0] !== "" && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = text("\n  Make public");
    			input2 = element("input");
    			t2 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "To-Do");
    			add_location(input0, file$5, 44, 2, 1092);
    			attr_dev(input1, "type", "submit");
    			input1.value = "Add";
    			add_location(input1, file$5, 45, 2, 1167);
    			attr_dev(input2, "type", "checkbox");
    			add_location(input2, file$5, 46, 13, 1216);
    			add_location(form, file$5, 43, 0, 1052);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, input0);
    			set_input_value(input0, /*feedback*/ ctx[1]);
    			append_dev(form, t0);
    			append_dev(form, input1);
    			append_dev(form, t1);
    			append_dev(form, input2);
    			set_input_value(input2, /*isPublic*/ ctx[2]);
    			insert_dev(target, t2, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[5]),
    					listen_dev(form, "submit", /*addFeedbackHandler*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*feedback*/ 2 && input0.value !== /*feedback*/ ctx[1]) {
    				set_input_value(input0, /*feedback*/ ctx[1]);
    			}

    			if (dirty & /*isPublic*/ 4) {
    				set_input_value(input2, /*isPublic*/ ctx[2]);
    			}

    			if (/*error*/ ctx[0] !== "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (detaching) detach_dev(t2);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("AddFeedback", slots, []);
    	let error = "";
    	let feedback = "";
    	let isPublic = true;

    	function addFeedbackHandler(e) {
    		e.preventDefault();

    		if (isPublic == true) {
    			userbase.shareDatabase({ databaseName: "public-feedback" }).then(({ shareToken }) => {
    				// Any other user can now open the database using this share token
    				console.log(shareToken);
    			}).then(() => {
    				userbase.insertItem({
    					databaseName: "public-feedback",
    					item: { feedback }
    				}).then(() => {
    					$$invalidate(1, feedback = "");
    				}).catch(errorFromApi => $$invalidate(0, error = errorFromApi));
    			}).catch(e => console.error(e));
    		} else {
    			userbase.insertItem({
    				databaseName: "private-feedback",
    				item: { feedback }
    			}).then(() => {
    				$$invalidate(1, feedback = "");
    			}).catch(errorFromApi => $$invalidate(0, error = errorFromApi));
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$3.warn(`<AddFeedback> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		feedback = this.value;
    		$$invalidate(1, feedback);
    	}

    	function input2_change_handler() {
    		isPublic = this.value;
    		$$invalidate(2, isPublic);
    	}

    	$$self.$capture_state = () => ({
    		error,
    		feedback,
    		isPublic,
    		addFeedbackHandler
    	});

    	$$self.$inject_state = $$props => {
    		if ("error" in $$props) $$invalidate(0, error = $$props.error);
    		if ("feedback" in $$props) $$invalidate(1, feedback = $$props.feedback);
    		if ("isPublic" in $$props) $$invalidate(2, isPublic = $$props.isPublic);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		error,
    		feedback,
    		isPublic,
    		addFeedbackHandler,
    		input0_input_handler,
    		input2_change_handler
    	];
    }

    class AddFeedback extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddFeedback",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* App.svelte generated by Svelte v3.35.0 */

    const { console: console_1$4 } = globals;
    const file$6 = "App.svelte";

    // (31:2) {#if !isLoadingAuth && isLoggedIn}
    function create_if_block_3(ctx) {
    	let button;
    	let current;

    	button = new Button({
    			props: {
    				style: "position: fixed; top: 10px; left: 10px;",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*handleSignout*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(button.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 64) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(31:2) {#if !isLoadingAuth && isLoggedIn}",
    		ctx
    	});

    	return block;
    }

    // (32:4) <Button       on:click={handleSignout}       style="position: fixed; top: 10px; left: 10px;">
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Sign out");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(32:4) <Button       on:click={handleSignout}       style=\\\"position: fixed; top: 10px; left: 10px;\\\">",
    		ctx
    	});

    	return block;
    }

    // (39:2) {:else}
    function create_else_block(ctx) {
    	let t;
    	let if_block1_anchor;
    	let current;
    	let if_block0 = /*isLoggedIn*/ ctx[1] === false && create_if_block_2(ctx);
    	let if_block1 = /*isLoggedIn*/ ctx[1] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*isLoggedIn*/ ctx[1] === false) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*isLoggedIn*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*isLoggedIn*/ ctx[1]) {
    				if (if_block1) {
    					if (dirty & /*isLoggedIn*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(39:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (37:2) {#if isLoadingAuth}
    function create_if_block$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Loading ...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(37:2) {#if isLoadingAuth}",
    		ctx
    	});

    	return block;
    }

    // (40:4) {#if isLoggedIn === false}
    function create_if_block_2(ctx) {
    	let auth;
    	let updating_isLoggedIn;
    	let t;
    	let login;
    	let updating_isLoggedIn_1;
    	let current;

    	function auth_isLoggedIn_binding(value) {
    		/*auth_isLoggedIn_binding*/ ctx[3](value);
    	}

    	let auth_props = {};

    	if (/*isLoggedIn*/ ctx[1] !== void 0) {
    		auth_props.isLoggedIn = /*isLoggedIn*/ ctx[1];
    	}

    	auth = new Auth({ props: auth_props, $$inline: true });
    	binding_callbacks.push(() => bind(auth, "isLoggedIn", auth_isLoggedIn_binding));

    	function login_isLoggedIn_binding(value) {
    		/*login_isLoggedIn_binding*/ ctx[4](value);
    	}

    	let login_props = {};

    	if (/*isLoggedIn*/ ctx[1] !== void 0) {
    		login_props.isLoggedIn = /*isLoggedIn*/ ctx[1];
    	}

    	login = new Login({ props: login_props, $$inline: true });
    	binding_callbacks.push(() => bind(login, "isLoggedIn", login_isLoggedIn_binding));

    	const block = {
    		c: function create() {
    			create_component(auth.$$.fragment);
    			t = space();
    			create_component(login.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(auth, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(login, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const auth_changes = {};

    			if (!updating_isLoggedIn && dirty & /*isLoggedIn*/ 2) {
    				updating_isLoggedIn = true;
    				auth_changes.isLoggedIn = /*isLoggedIn*/ ctx[1];
    				add_flush_callback(() => updating_isLoggedIn = false);
    			}

    			auth.$set(auth_changes);
    			const login_changes = {};

    			if (!updating_isLoggedIn_1 && dirty & /*isLoggedIn*/ 2) {
    				updating_isLoggedIn_1 = true;
    				login_changes.isLoggedIn = /*isLoggedIn*/ ctx[1];
    				add_flush_callback(() => updating_isLoggedIn_1 = false);
    			}

    			login.$set(login_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(auth.$$.fragment, local);
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(auth.$$.fragment, local);
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(auth, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(login, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(40:4) {#if isLoggedIn === false}",
    		ctx
    	});

    	return block;
    }

    // (44:4) {#if isLoggedIn}
    function create_if_block_1(ctx) {
    	let addfeedback;
    	let t;
    	let displayfeedback;
    	let current;
    	addfeedback = new AddFeedback({ $$inline: true });
    	displayfeedback = new DisplayFeedback({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(addfeedback.$$.fragment);
    			t = space();
    			create_component(displayfeedback.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(addfeedback, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(displayfeedback, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(addfeedback.$$.fragment, local);
    			transition_in(displayfeedback.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(addfeedback.$$.fragment, local);
    			transition_out(displayfeedback.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(addfeedback, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(displayfeedback, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(44:4) {#if isLoggedIn}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let main;
    	let t;
    	let current_block_type_index;
    	let if_block1;
    	let current;
    	let if_block0 = !/*isLoadingAuth*/ ctx[0] && /*isLoggedIn*/ ctx[1] && create_if_block_3(ctx);
    	const if_block_creators = [create_if_block$2, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*isLoadingAuth*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			attr_dev(main, "class", "svelte-16ryb3l");
    			add_location(main, file$6, 29, 0, 838);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isLoadingAuth*/ ctx[0] && /*isLoggedIn*/ ctx[1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*isLoadingAuth, isLoggedIn*/ 3) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block1 = if_blocks[current_block_type_index];

    				if (!if_block1) {
    					if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block1.c();
    				} else {
    					if_block1.p(ctx, dirty);
    				}

    				transition_in(if_block1, 1);
    				if_block1.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let isLoadingAuth = true;
    	let isLoggedIn = false;

    	userbase.init({
    		appId: "5603514f-012b-4412-9956-cb04483a6ca7"
    	}).then(session => {
    		if (session.user) $$invalidate(1, isLoggedIn = true);
    	}).catch(error => console.log(error)).finally(() => $$invalidate(0, isLoadingAuth = false));

    	const userbaseSession = localStorage.getItem("userbaseCurrentSession");

    	if (userbaseSession) {
    		isLoggedIn = JSON.parse(userbaseSession).signedIn;
    	}

    	function handleSignout() {
    		userbase.signOut().then(() => $$invalidate(1, isLoggedIn = false));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$4.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function auth_isLoggedIn_binding(value) {
    		isLoggedIn = value;
    		$$invalidate(1, isLoggedIn);
    	}

    	function login_isLoggedIn_binding(value) {
    		isLoggedIn = value;
    		$$invalidate(1, isLoggedIn);
    	}

    	$$self.$capture_state = () => ({
    		Auth,
    		Login,
    		Button,
    		DisplayFeedback,
    		AddFeedback,
    		isLoadingAuth,
    		isLoggedIn,
    		userbaseSession,
    		handleSignout
    	});

    	$$self.$inject_state = $$props => {
    		if ("isLoadingAuth" in $$props) $$invalidate(0, isLoadingAuth = $$props.isLoadingAuth);
    		if ("isLoggedIn" in $$props) $$invalidate(1, isLoggedIn = $$props.isLoggedIn);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		isLoadingAuth,
    		isLoggedIn,
    		handleSignout,
    		auth_isLoggedIn_binding,
    		login_isLoggedIn_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
