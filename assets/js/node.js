////////////////////////////////////////////////////////////////////////////////////////
// Node
////////////////////////////////////////////////////////////////////////////////////////
fabric.Node = fabric.util.createClass(fabric.Group, {
    type: 'Node',
    initialize: function (options) {
        console.log('I am a Node!');

        // calls the parent's constructor
        // super();
        /**
         * @param {Object} [options]
         * @param {string} [options.id] - hook id.
         * @param {fabric.Node} [options.node] - node that this hook belongs to
         * @param {string} [options.caption] - caption to print in front of the hook
         * @param {string} [options.io] - 'in' or 'out', defines if this hook is input or output of its node

         */
        console.log(options);
        let default_options = {
            width: 150,
            height: 150,
            hooks: [{id: 'in', caption: 'in', io: 'in'}, //todo: remove bullet_options
                {id: 'out', caption: 'out', io: 'out'}],
            caption: '',
            orientation: 'horizontal', // else vertical //todo: should be a canvas property
            // extend options with fabric properties
            fill: 'white',
            originX: 'left',
            originY: 'top',
            subTargetCheck: true,
            lockScalingX: true,
            lockScalingY: true,
            // lockUniScaling: true,
            hasRotatingPoint: false,
            hoverCursor: 'default',
            cornerSize: 0,
        };

        this.options = Object.assign(default_options, options);

        this.id = this.options.id;
        // calls the parent's constructor
        this.callSuper('initialize', [], this.options);

        // create body and caption of the node
        this.createBody();
        this.createCaption();

        if (this.canvas) {
            this.toCanvas(this.canvas)
        }
        // create hooks
        // this.hooks_data = [];
        this.hooks = {in: [], out: []};
        this.hooks_by_id = {};
        this.defineHooks(this.options.hooks);
        console.log(this._objects);

        this.addWithUpdate();
        console.log(this._objects);

        // event handlers
        this.on('selected', function (options) {
            console.log('selected');

            let event = new CustomEvent('nodes.selected', {
                detail: {
                    node: this,
                    id: this.id,
                    caption: this.caption,
                    fill: this.body.fill,
                    width: this.body.width,
                    height: this.body.height,
                    json: JSON.stringify(this.toObject(), null, 2)
                }
            });
            document.dispatchEvent(event);

        });

        this.on('deselected', function (options) {
            // if (this.body.containsPoint(options.e))
            //     console.log('AAAAA');
            // console.log(e.target.top, e.target.left);
            // this.body.set('fill', '#ddd');
            console.log('deselected');
        });

        this.on('moved', function (options) {
            // if (this.body.containsPoint(options.e))
            //     console.log('AAAAA');
            // console.log(e.target.top, e.target.left);
            console.log('moved');
        });

        this.on('mousedown', this._mouseDownHandler);

        // this.set('dirty', true);
        this.setCoords();
        //
        this.setShadow({color: 'rgba(255,255,255,0.3)'});

        this.connect = function (hook_id, to_node) {
            let hook = this.get_hook_by_id(hook_id);
            hook.to_node = to_node;
        };

    },

    toCanvas(canvas) {
        canvas.addNode(this);
        this.graph = canvas.graph;
    },

    toObject() {
        return {
            id: this.id,
            caption: this.caption,
        }
    },

    getParents() {

        let parents = [];

        this.hooks.in.forEach(hook => {
            hook.edges.forEach(edge => {
                parents.push(edge.other_hook.node);
            })
        });

        parents = Array.from(new Set(parents)); // get unique
        return parents

    },

    getAncestors() {

        let ancestors = [];

        let children = [this];

        while (children.length > 0) {
            let child = children.shift();
            let parents = child.getParents();
            parents.forEach(parent => {
                ancestors.push(parent);
                children.push(parent)
            });
        }
        ancestors = Array.from(new Set(ancestors)); // get unique
        return ancestors

    },

    getParents() {

        let parents = [];

        this.hooks.in.forEach(hook => {
            hook.edges.forEach(edge => {
                parents.push(edge.other_hook.node);
            })
        });

        parents = Array.from(new Set(parents)); // get unique
        return parents

    },

    getAncestors() {

        let ancestors = [];

        let children = [this];

        while (children.length > 0) {
            let child = children.shift();
            let parents = child.getParents();
            parents.forEach(parent => {
                ancestors.push(parent);
                children.push(parent)
            });
        }
        ancestors = Array.from(new Set(ancestors)); // get unique
        return ancestors

    },

    allowConnection(source_node, target_node) {
        if (this.canvas.graph.isAcyclic) {
            if (source_node === target_node) {
                return false
            } else {
                let ancestors = source_node.getAncestors();
                return !(ancestors.includes(target_node));
            }
        }
        return true
    },

    createBody() {
        this.body = new fabric.Rect({
            name: 'body',
            originX: 'left',
            originY: 'top',
            top: 0,
            left: 0,
            width: this.width,
            height: this.height,
            rx: 4,
            ry: 4,
            fill: this.options.fill,
            stroke: '#444',
            fillRule: "nonzero",
            shadow: {color: 'rgba(0,0,0,0.3)', offsetX: 5, offsetY: 5, blur: 5}
        });
        this.add(this.body);
    },

    createCaption() {
        this.caption_object = new fabric.Text(this.options.caption, {
                originX: 'center',
                originY: 'center',
                fontFamily: 'Arial',
                fontSize: 18,
                fontStyle: 'bold',
                top: this.body.height / 3,
                left: this.body.width / 2,
                width: this.body.width - 10,
                fill: 'red',
                stroke: null
            }
        );
        this.add(this.caption_object);

        // Truncate caption text if necessary
        // TODO: also truncate later when caption is changed OR when width is changed
        console.log("caption width: " + this.caption_object.width);
        while (this.caption_object.width > this.body.width - 10) {
            this.caption_object.set('text', this.caption_object.text.slice(0, -1));
        }
    },

    getHookCenter(hook_arg) {
        // Get center point, in absolute coords, of hook bullet.
        // hook_arg may be a hook or a hook_id

        let hook, bullet_center, radius, node_center;
        if (typeof hook_arg == "object") {
            hook = hook_arg;
        } else {
            hook = this.get_hook_by_id(hook_arg);
        }

        bullet_center = hook.bullet.getCenterPoint();
        node_center = this.getCenterPoint();
        radius = (hook.side === 'left' ? -hook.bullet.radius : hook.bullet.radius);
        return {
            x: node_center.x + bullet_center.x + radius, //node_center.x
            y: node_center.y + bullet_center.y //node_center.y
        };
    },

    resetHooks() {
        // TODO: SHOULD BE I LOGICAL NODE
        // TODO: be more subtile: delete only connection that have been disturbed
        Object.values(this.hooks_by_id).map(hook => hook.removeFromCanvas());
        this.hooks = {in: [], out: []};
        this.hooks_by_id = {};
    },

    defineHooks(hooks_data) {
        // TODO: hooks_data should rather be a dict with key hook_id
        // this.hooks = hooks;
        this.max_hooks_positions = {top: 15, left: 15, right: 15, bottom: 15};

        hooks_data.forEach(hook_data => this.addHook(hook_data));

    },

    addHook(options) {

        options.bullet_options = options.bullet_options || {};

        console.log(this);

        if (this.canvas && options.type && this.canvas.hook_types && options.type in this.canvas.hook_types) {
            let hook_type_options = this.canvas.hook_types[options.type];
            options.io = options.io || hook_type_options.io;
            options.expects = options.expects || hook_type_options.expects;
            options.provides = options.provides || hook_type_options.provides;
            options.links_options = options.links_options || hook_type_options.links_options;
            options.bullet_options = options.bullet_options || hook_type_options.bullet_options;
            options.bullet_options.fill = hook_type_options.color;
        }

        if (!options.io) {
            throw 'IO of hook must be specified. '
        }

        let hook = new Hook(
            options.id,
            this, // node
            options.caption,
            options.type,
            options.io,
            options.links_options,
            options.expects,
            options.provides);

        // let hook_data = {id: id, caption: hook.caption, type: hook.type, io: hook.io} // TODO: move that to a method 'toObject' in Hook class
        // this.hooks_data.push(hook_data);
        this.hooks_by_id[hook.id] = hook;
        this.hooks[options.io].push(hook);
        hook.createBullet(options.bullet_options);
    },
    getHooks() {
        return this.hooks.in.concat(this.hooks.out)
    },
    getHook(hook_id) {
        return this.getHooks().find(hook => hook.id === hook_id);
    },

    get_hook_by_id(hook_id) {
        if (!this.hooks_by_id.hasOwnProperty(hook_id)) {
            throw "Node has no hook with id " + hook_id;
        }
        return this.hooks_by_id[hook_id];
    },

    // todo: remove those and usagee

    drawEdges() {
        if (!this.canvas) {
            throw 'Node should be added to a canvas before edges can be drawn!'
        }
        // Draw all links from hooks of this node

        // Draw floating point
        if (this.canvas.floating_endpoint && this.canvas.floating_endpoint.from_node == this) {
            this.canvas.drawFloatingPath()
        }

        let pt1, pt2;

        this.getHooks().forEach(hook => {
            pt1 = hook.getCenter();

            hook.edges.forEach(edge => {       // hook.links is array with hook_ref as keys

                pt2 = edge.other_hook.getCenter();

                if (hook.io === 'in') {
                    // hook is of type 'in': find path via other hook
                    let other_hook = edge.other_hook;
                    let edge_from_other_hook = other_hook.edges.find(edge => edge.other_hook === hook);
                    this.canvas.removePath(edge_from_other_hook.path);
                    edge_from_other_hook.path = this.canvas.addPath(pt2, pt1, edge);
                } else {
                    // hook is of type 'out': it holds the path
                    if (edge.path) {
                        this.canvas.removePath(edge.path);
                    }
                    edge.path = this.canvas.addPath(pt1, pt2, edge);
                }
            }, 0)
        }, 0)
    },

    _mouseDownHandler(options) {
        console.log('node_mouse_down' + options.target.caption);
        let canvas = this.canvas;
        let target = options.target;

        if (options.subTargets && options.subTargets.length > 0) {
            // user has clicked on one object from Node 's objects
            let inner_target = options.subTargets[0];
            if (inner_target.type === 'hook-bullet') {
                // this object was indeed a hook bullet

                let hook_bullet = inner_target;
                let hook = hook_bullet.hook;

                if (options.e && options.e.ctrlKey === true) {
                    // Ctrl-Click on bullet:  Delete all links
                    console.log('CONTROL CLICK ON BULLET');
                    // Ctrl-Click on bullet means remove all links
                    for (let hook_ref in hook.links) {       // hook.links is array with hook_ref as keys
                        let link = hook.links[hook_ref];
                        let other_hook = link.other_hook;
                        if (link.path) {
                            // link is outbound: it holds the path
                            canvas.remove(link.path);
                        } else {
                            // link must be inbound: the other end of the link holds the path
                            canvas.remove(other_hook.links[hook.getRef()].path);
                        }
                        delete hook.links[hook_ref];
                        delete other_hook.links[hook.getRef()];
                    }

                } else {
                    // Click without Ctrl key pressed:  create floating endpoint
                    console.log(inner_target);
                    let end_point;
                    if (hook.io === 'out') {

                        this.canvas.clearFloatingEndpoint();

                        // Create a new endpoint

                        console.log(options);

                        let pt1 = this.getHookCenter(hook);

                        end_point = new fabric.Circle({
                            type: 'end_point',
                            name: 'end_point',
                            originX: 'center',
                            originY: 'center',
                            top: pt1.y + 5,
                            left: pt1.x + 25,
                            radius: 5,
                            fill: hook.bullet.fill,
                            stroke: hook.bullet.stroke,
                            hasControls: false,
                            hasBorders: false,
                            from_hook: hook,
                            from_node: target,
                            hoverCursor: 'default',

                        });

                        this.canvas.add(end_point);
                        this.canvas.floating_endpoint = end_point;
                        this.canvas.drawEdges();

                    }

                }
            }
        }
    },
    toObject(includeCanvasProperties = false) {
        let hooks_data = [];

        for (let hook_type in this.hooks) {
            let hooks_by_type = this.hooks[hook_type];
            for (let i = 0; i < hooks_by_type.length; i++) {

                let hook = hooks_by_type[i];
                hooks_data.push(hook.toObject(includeCanvasProperties))
            }
        }
        if (includeCanvasProperties) {
            return {
                id: this.id,
                caption: this.caption,
                top: this.top,
                left: this.left,
                width: this.body.width,
                height: this.body.height,
                hooks: hooks_data,
            }
        } else {
            return {
                id: this.id,
                caption: this.caption,
                hooks: hooks_data,
            }
        }

    }
    ,

    update(options) {
        options = JSON.parse((options));
        // id => CANNOT be changed, or?? @Pap?
        // caption
        if (options.caption) this.caption = options.caption;
        // hooks
        // if hooks have been change

        // if this node is plugged, remove all connexions
        this.resetHooks();
        this.defineHooks(options.hooks);

    }
    ,

    clone() {
        let json_obj = this.toObject();
        delete json_obj.id;
        json_obj.left += 50;
        json_obj.top += 50;
        console.log(json_obj);
        let new_node = this.canvas.AddNode(json_obj);
        this.canvas.setActiveObject(new_node); //New object becomes the selected object
    }
    ,

    setFill(fill) {
        this.body.set('fill', fill);
    }

})


