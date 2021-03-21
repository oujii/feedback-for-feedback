var app = (function () {
    'use strict';

    function noop() { }
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
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

    /* components/FeedItem.svelte generated by Svelte v3.35.0 */

    const { console: console_1 } = globals;
    const file = "components/FeedItem.svelte";

    // (43:2) {#if isExpanded}
    function create_if_block(ctx) {
    	let p;
    	let t0_value = /*item*/ ctx[0].description + "";
    	let t0;
    	let t1;
    	let form;
    	let label;
    	let t2;
    	let input;
    	let t3;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			form = element("form");
    			label = element("label");
    			t2 = text("Headline\n        ");
    			input = element("input");
    			t3 = space();
    			button = element("button");
    			button.textContent = "Add";
    			add_location(p, file, 43, 4, 1237);
    			attr_dev(input, "type", "text");
    			input.required = true;
    			attr_dev(input, "placeholder", "Add feedback");
    			attr_dev(input, "class", "block w-full p-2 border border-gray rounded-md");
    			add_location(input, file, 50, 8, 1421);
    			attr_dev(label, "class", "flex-1");
    			add_location(label, file, 48, 6, 1373);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "flex-initial bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-8 border border-blue-700 rounded");
    			add_location(button, file, 58, 6, 1639);
    			attr_dev(form, "class", "flex pt-2 mt-2 border-t border-black");
    			add_location(form, file, 44, 4, 1267);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, form, anchor);
    			append_dev(form, label);
    			append_dev(label, t2);
    			append_dev(label, input);
    			set_input_value(input, /*feedbackText*/ ctx[2]);
    			append_dev(form, t3);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[4]),
    					listen_dev(form, "submit", /*addFeedbackHandler*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*item*/ 1 && t0_value !== (t0_value = /*item*/ ctx[0].description + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*feedbackText*/ 4 && input.value !== /*feedbackText*/ ctx[2]) {
    				set_input_value(input, /*feedbackText*/ ctx[2]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(43:2) {#if isExpanded}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let li;
    	let div;
    	let h3;
    	let t0_value = /*item*/ ctx[0].headline + "";
    	let t0;
    	let t1;
    	let svg;
    	let path;
    	let t2;
    	let mounted;
    	let dispose;
    	let if_block = /*isExpanded*/ ctx[1] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			li = element("li");
    			div = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(h3, "class", "mr-2");
    			add_location(h3, file, 29, 4, 729);
    			attr_dev(path, "fill", "currentColor");
    			attr_dev(path, "d", "M1679.339 301.56q0 53-37 90l-651 651q-38 38-91 38-54 0-90-38l-651-651q-38-36-38-90 0-53 38-91l74-75q39-37 91-37 53 0 90 37l486 486 486-486q37-37 90-37 52 0 91 37l75 75q37 39 37 91z");
    			add_location(path, file, 36, 7, 958);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 -256 1792 1792");
    			attr_dev(svg, "width", "20px");
    			attr_dev(svg, "class", "transform ease-out duration-200");
    			toggle_class(svg, "rotate-180", /*isExpanded*/ ctx[1]);
    			add_location(svg, file, 30, 4, 771);
    			attr_dev(div, "class", "flex items-center cursor-pointer");
    			toggle_class(div, "mb-4", /*isExpanded*/ ctx[1]);
    			add_location(div, file, 28, 2, 654);
    			attr_dev(li, "class", "w-full flex flex-col p-4 bg-white shadow cursor-pointer hover:border hover:border-black rounded-lg");
    			attr_dev(li, "role", "button");
    			attr_dev(li, "aria-expanded", /*isExpanded*/ ctx[1]);
    			add_location(li, file, 22, 0, 446);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, div);
    			append_dev(div, h3);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, svg);
    			append_dev(svg, path);
    			append_dev(li, t2);
    			if (if_block) if_block.m(li, null);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*item*/ 1 && t0_value !== (t0_value = /*item*/ ctx[0].headline + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*isExpanded*/ 2) {
    				toggle_class(svg, "rotate-180", /*isExpanded*/ ctx[1]);
    			}

    			if (dirty & /*isExpanded*/ 2) {
    				toggle_class(div, "mb-4", /*isExpanded*/ ctx[1]);
    			}

    			if (/*isExpanded*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(li, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*isExpanded*/ 2) {
    				attr_dev(li, "aria-expanded", /*isExpanded*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
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
    	validate_slots("FeedItem", slots, []);
    	let { item } = $$props;
    	let isExpanded = false;
    	let feedbackText = "";

    	function addFeedbackHandler(e) {
    		e.preventDefault();
    		if (!db) return;

    		db.collection("feedback").add({ text: feedbackText }).then(docRef => {
    			console.log("Document written with ID: ", docRef.id);
    		}).catch(error => {
    			console.error("Error adding document: ", error);
    		});
    	}

    	const writable_props = ["item"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<FeedItem> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		feedbackText = this.value;
    		$$invalidate(2, feedbackText);
    	}

    	const click_handler = () => $$invalidate(1, isExpanded = !isExpanded);

    	$$self.$$set = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    	};

    	$$self.$capture_state = () => ({
    		item,
    		isExpanded,
    		feedbackText,
    		addFeedbackHandler
    	});

    	$$self.$inject_state = $$props => {
    		if ("item" in $$props) $$invalidate(0, item = $$props.item);
    		if ("isExpanded" in $$props) $$invalidate(1, isExpanded = $$props.isExpanded);
    		if ("feedbackText" in $$props) $$invalidate(2, feedbackText = $$props.feedbackText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		item,
    		isExpanded,
    		feedbackText,
    		addFeedbackHandler,
    		input_input_handler,
    		click_handler
    	];
    }

    class FeedItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { item: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FeedItem",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*item*/ ctx[0] === undefined && !("item" in props)) {
    			console_1.warn("<FeedItem> was created without expected prop 'item'");
    		}
    	}

    	get item() {
    		throw new Error("<FeedItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<FeedItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/Feed.svelte generated by Svelte v3.35.0 */

    const { console: console_1$1 } = globals;
    const file$1 = "components/Feed.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (20:0) {#if items}
    function create_if_block$1(ctx) {
    	let ul;
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
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "w-full flex-1 flex flex-col items-center list-none gap-2 p-10 bg-gray-100 overflow-auto");
    			add_location(ul, file$1, 20, 2, 403);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

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
    						each_blocks[i].m(ul, null);
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
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(20:0) {#if items}",
    		ctx
    	});

    	return block;
    }

    // (24:4) {#each items as item}
    function create_each_block(ctx) {
    	let feeditem;
    	let current;

    	feeditem = new FeedItem({
    			props: { item: /*item*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(feeditem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(feeditem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const feeditem_changes = {};
    			if (dirty & /*items*/ 1) feeditem_changes.item = /*item*/ ctx[2];
    			feeditem.$set(feeditem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(feeditem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(feeditem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(feeditem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(24:4) {#each items as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*items*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
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
    					if_block = create_if_block$1(ctx);
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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	validate_slots("Feed", slots, []);
    	let { db } = $$props;
    	let items;
    	const writable_props = ["db"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Feed> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("db" in $$props) $$invalidate(1, db = $$props.db);
    	};

    	$$self.$capture_state = () => ({ FeedItem, db, items });

    	$$self.$inject_state = $$props => {
    		if ("db" in $$props) $$invalidate(1, db = $$props.db);
    		if ("items" in $$props) $$invalidate(0, items = $$props.items);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*db*/ 2) {
    			 {
    				if (db) {
    					db.collection("feedback").onSnapshot(querySnapshot => {
    						const feedback = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    						console.log("feedback", feedback);
    						$$invalidate(0, items = feedback);
    					});
    				}
    			}
    		}
    	};

    	return [items, db];
    }

    class Feed extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { db: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Feed",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*db*/ ctx[1] === undefined && !("db" in props)) {
    			console_1$1.warn("<Feed> was created without expected prop 'db'");
    		}
    	}

    	get db() {
    		throw new Error("<Feed>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set db(value) {
    		throw new Error("<Feed>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/AddFeedback.svelte generated by Svelte v3.35.0 */

    const { console: console_1$2 } = globals;
    const file$2 = "components/AddFeedback.svelte";

    // (54:2) {#if isExpanded}
    function create_if_block$2(ctx) {
    	let form;
    	let label0;
    	let t0;
    	let input0;
    	let t1;
    	let label1;
    	let t2;
    	let input1;
    	let t3;
    	let button;
    	let t4;
    	let button_disabled_value;
    	let t5;
    	let mounted;
    	let dispose;
    	let if_block = /*error*/ ctx[0] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			form = element("form");
    			label0 = element("label");
    			t0 = text("Headline\n        ");
    			input0 = element("input");
    			t1 = space();
    			label1 = element("label");
    			t2 = text("Description\n        ");
    			input1 = element("input");
    			t3 = space();
    			button = element("button");
    			t4 = text("Add");
    			t5 = space();
    			if (if_block) if_block.c();
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "class", "block w-full p-2 border border-gray rounded-md");
    			add_location(input0, file$2, 57, 8, 1482);
    			attr_dev(label0, "class", "flex-1 mb-2");
    			add_location(label0, file$2, 55, 6, 1429);
    			attr_dev(input1, "type", "text");
    			input1.required = true;
    			attr_dev(input1, "class", "block w-full p-2 border border-gray rounded-md");
    			add_location(input1, file$2, 66, 8, 1715);
    			attr_dev(label1, "class", "flex-1 mb-4");
    			add_location(label1, file$2, 64, 6, 1659);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "bg-blue-500 hover:bg-blue-700 disabled:opacity-10 text-white font-bold py-2 px-8 border border-blue-700 rounded");
    			button.disabled = button_disabled_value = !/*headline*/ ctx[1] && !/*description*/ ctx[2];
    			add_location(button, file$2, 73, 6, 1895);
    			attr_dev(form, "class", "flex flex-col");
    			add_location(form, file$2, 54, 4, 1363);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, label0);
    			append_dev(label0, t0);
    			append_dev(label0, input0);
    			set_input_value(input0, /*headline*/ ctx[1]);
    			append_dev(form, t1);
    			append_dev(form, label1);
    			append_dev(label1, t2);
    			append_dev(label1, input1);
    			set_input_value(input1, /*description*/ ctx[2]);
    			append_dev(form, t3);
    			append_dev(form, button);
    			append_dev(button, t4);
    			append_dev(form, t5);
    			if (if_block) if_block.m(form, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(form, "submit", /*addFeedbackHandler*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*headline*/ 2 && input0.value !== /*headline*/ ctx[1]) {
    				set_input_value(input0, /*headline*/ ctx[1]);
    			}

    			if (dirty & /*description*/ 4 && input1.value !== /*description*/ ctx[2]) {
    				set_input_value(input1, /*description*/ ctx[2]);
    			}

    			if (dirty & /*headline, description*/ 6 && button_disabled_value !== (button_disabled_value = !/*headline*/ ctx[1] && !/*description*/ ctx[2])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (/*error*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(form, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(54:2) {#if isExpanded}",
    		ctx
    	});

    	return block;
    }

    // (81:6) {#if error}
    function create_if_block_1(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*error*/ ctx[0]);
    			attr_dev(p, "class", "text-red-500");
    			add_location(p, file$2, 81, 8, 2160);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 1) set_data_dev(t, /*error*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(81:6) {#if error}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let aside;
    	let div;
    	let h3;
    	let t1;
    	let svg;
    	let path;
    	let t2;
    	let mounted;
    	let dispose;
    	let if_block = /*isExpanded*/ ctx[3] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			aside = element("aside");
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Add item";
    			t1 = space();
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(h3, "class", "mr-2");
    			add_location(h3, file$2, 40, 4, 862);
    			attr_dev(path, "fill", "currentColor");
    			attr_dev(path, "d", "M1679.339 301.56q0 53-37 90l-651 651q-38 38-91 38-54 0-90-38l-651-651q-38-36-38-90 0-53 38-91l74-75q39-37 91-37 53 0 90 37l486 486 486-486q37-37 90-37 52 0 91 37l75 75q37 39 37 91z");
    			add_location(path, file$2, 47, 7, 1084);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 -256 1792 1792");
    			attr_dev(svg, "width", "20px");
    			attr_dev(svg, "class", "transform ease-out duration-200");
    			toggle_class(svg, "rotate-180", /*isExpanded*/ ctx[3]);
    			add_location(svg, file$2, 41, 4, 897);
    			attr_dev(div, "class", "flex items-center cursor-pointer mb-4");
    			attr_dev(div, "role", "button");
    			attr_dev(div, "aria-expanded", /*isExpanded*/ ctx[3]);
    			add_location(div, file$2, 34, 2, 702);
    			attr_dev(aside, "class", "max-w-sm absolute right-10 top-10 bg-white");
    			toggle_class(aside, "shadow", /*isExpanded*/ ctx[3]);
    			toggle_class(aside, "p-2", /*isExpanded*/ ctx[3]);
    			add_location(aside, file$2, 29, 0, 585);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, aside, anchor);
    			append_dev(aside, div);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, svg);
    			append_dev(svg, path);
    			append_dev(aside, t2);
    			if (if_block) if_block.m(aside, null);

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*click_handler*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*isExpanded*/ 8) {
    				toggle_class(svg, "rotate-180", /*isExpanded*/ ctx[3]);
    			}

    			if (dirty & /*isExpanded*/ 8) {
    				attr_dev(div, "aria-expanded", /*isExpanded*/ ctx[3]);
    			}

    			if (/*isExpanded*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(aside, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*isExpanded*/ 8) {
    				toggle_class(aside, "shadow", /*isExpanded*/ ctx[3]);
    			}

    			if (dirty & /*isExpanded*/ 8) {
    				toggle_class(aside, "p-2", /*isExpanded*/ ctx[3]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(aside);
    			if (if_block) if_block.d();
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
    	validate_slots("AddFeedback", slots, []);
    	let error = "";
    	let headline = "";
    	let description = "";
    	let isExpanded = false;
    	let { db } = $$props;

    	function addFeedbackHandler(e) {
    		e.preventDefault();
    		if (!db) return;

    		db.collection("feedback").add({ headline, description }).then(docRef => {
    			console.log("Document written with ID: ", docRef.id);
    			$$invalidate(0, error = "");
    			$$invalidate(1, headline = "");
    			$$invalidate(2, description = "");
    		}).catch(error => {
    			console.error("Error adding document: ", error);
    			error = error;
    		});
    	}

    	const writable_props = ["db"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$2.warn(`<AddFeedback> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(3, isExpanded = !isExpanded);

    	function input0_input_handler() {
    		headline = this.value;
    		$$invalidate(1, headline);
    	}

    	function input1_input_handler() {
    		description = this.value;
    		$$invalidate(2, description);
    	}

    	$$self.$$set = $$props => {
    		if ("db" in $$props) $$invalidate(5, db = $$props.db);
    	};

    	$$self.$capture_state = () => ({
    		error,
    		headline,
    		description,
    		isExpanded,
    		db,
    		addFeedbackHandler
    	});

    	$$self.$inject_state = $$props => {
    		if ("error" in $$props) $$invalidate(0, error = $$props.error);
    		if ("headline" in $$props) $$invalidate(1, headline = $$props.headline);
    		if ("description" in $$props) $$invalidate(2, description = $$props.description);
    		if ("isExpanded" in $$props) $$invalidate(3, isExpanded = $$props.isExpanded);
    		if ("db" in $$props) $$invalidate(5, db = $$props.db);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		error,
    		headline,
    		description,
    		isExpanded,
    		addFeedbackHandler,
    		db,
    		click_handler,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class AddFeedback extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { db: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddFeedback",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*db*/ ctx[5] === undefined && !("db" in props)) {
    			console_1$2.warn("<AddFeedback> was created without expected prop 'db'");
    		}
    	}

    	get db() {
    		throw new Error("<AddFeedback>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set db(value) {
    		throw new Error("<AddFeedback>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* App.svelte generated by Svelte v3.35.0 */
    const file$3 = "App.svelte";

    function create_fragment$3(ctx) {
    	let main;
    	let section;
    	let h1;
    	let t1;
    	let addfeedback;
    	let t2;
    	let feed;
    	let current;

    	addfeedback = new AddFeedback({
    			props: { db: /*db*/ ctx[0] },
    			$$inline: true
    		});

    	feed = new Feed({
    			props: { db: /*db*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			section = element("section");
    			h1 = element("h1");
    			h1.textContent = "feedback for feedback";
    			t1 = space();
    			create_component(addfeedback.$$.fragment);
    			t2 = space();
    			create_component(feed.$$.fragment);
    			attr_dev(h1, "class", "text-green-500");
    			add_location(h1, file$3, 9, 4, 248);
    			attr_dev(section, "class", "h-32 p-10");
    			add_location(section, file$3, 8, 2, 216);
    			attr_dev(main, "class", "flex flex-col h-full overflow-hidden");
    			add_location(main, file$3, 7, 0, 162);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, section);
    			append_dev(section, h1);
    			append_dev(section, t1);
    			mount_component(addfeedback, section, null);
    			append_dev(main, t2);
    			mount_component(feed, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(addfeedback.$$.fragment, local);
    			transition_in(feed.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(addfeedback.$$.fragment, local);
    			transition_out(feed.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(addfeedback);
    			destroy_component(feed);
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
    	validate_slots("App", slots, []);
    	let db = firebase.firestore();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Feed, AddFeedback, db });

    	$$self.$inject_state = $$props => {
    		if ("db" in $$props) $$invalidate(0, db = $$props.db);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [db];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
