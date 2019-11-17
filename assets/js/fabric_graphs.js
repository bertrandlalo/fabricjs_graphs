////////////////////////////////////////////////////////////////////////////////////////
// Canvas
////////////////////////////////////////////////////////////////////////////////////////

/**
 * Extends fabric.Canvas
 *
 * This class provides methods for ....
 *
 * The following events are provided: .....
 *
 */

class GraphCanvas extends fabric.Canvas {
    constructor(options) {
        super(options);
        this.all_nodes = {};
        this.floating_endpoint = null;


        //////////////
        // Custom event listeners
        //////////////
        // this.on('object:moving', this.draw_all_links);
        this.on('object:moving', function (options) {
            console.log('object:moving ' + options.target.type);
            if (options.target.type === 'Node') {
                // Moving object is a node, redraw all links from this node (should be to AND from)
                options.target.draw_links();
            }
            if (options.target.type === 'end_point') {
                var end_point = options.target;
                var node = end_point.from_node;
                node.draw_links();
            }
        });

        this.on('mouse:down', function (options) {
            var evt = options.e;
            if (evt.ctrlKey === true) {
                // Ctrl-Click is used to start drag
                this.isDragging = true;
                this.selection = false;
                this.lastPosX = evt.clientX;
                this.lastPosY = evt.clientY;
            }
        });


        // Do drag
        this.on('mouse:move', function (options) {
            if (this.isDragging) {
                var e = options.e;
                this.viewportTransform[4] += e.clientX - this.lastPosX;
                this.viewportTransform[5] += e.clientY - this.lastPosY;
                this.requestRenderAll();
                this.lastPosX = e.clientX;
                this.lastPosY = e.clientY;
            }
        });

        // End drag
        this.on('mouse:up', function (opt) {
            this.isDragging = false;
            this.selection = true;

            this.getObjects().forEach(function (targ) {
                targ.setCoords();
            });

            this.renderAll();

        });

        this.on('object:moved', function (options) {
            console.log('object:moved ' + options.target.type);

            if (options.target.type === 'Node') {
                options.target.draw_links();
            } else if (options.target.type === 'end_point') {
                var end_point = options.target;
                this.end_point_moved(end_point);
            }
        });


        this.on('object:selected', function (options) {
            console.log('object:selected ' + options.target.type);
            if (options.target.type === 'path') {
                options.target.set('strokeWidth', 4);
            }
        });

        this.on('mouse:wheel', function (opt) {
            var delta = opt.e.deltaY;
            var zoom = this.getZoom();
            zoom = zoom + delta / 200;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            this.zoomToPoint({x: opt.e.offsetX, y: opt.e.offsetY}, zoom);
            opt.e.preventDefault();
            opt.e.stopPropagation();
            var vpt = this.viewportTransform;
            if (zoom < 400 / 1000) {
                this.viewportTransform[4] = 200 - 1000 * zoom / 2;
                this.viewportTransform[5] = 200 - 1000 * zoom / 2;
            } else {
                if (vpt[4] >= 0) {
                    this.viewportTransform[4] = 0;
                } else if (vpt[4] < this.getWidth() - 1000 * zoom) {
                    this.viewportTransform[4] = this.getWidth() - 1000 * zoom;
                }
                if (vpt[5] >= 0) {
                    this.viewportTransform[5] = 0;
                } else if (vpt[5] < this.getHeight() - 1000 * zoom) {
                    this.viewportTransform[5] = this.getHeight() - 1000 * zoom;
                }
            }

            // Recalc objects coordinates (otherwise selection is not working)
            this.forEachObject(function (obj) {
                obj.setCoords();
            });

            this.renderAll();
        });

    };


    handle_keydown(ev) {

        var obj = this.getActiveObject();
        var selected_node = typeof obj && obj.type === 'Node' ? obj : null;
        var selected_graph_path = typeof obj && obj.type === 'GraphPath' ? obj : null;

        console.log('handle_keydown ' + ev.key + ' on ' + (selected_node ? selected_node.name : 'none'));

        if (selected_node) {
            if (ev.key === 'd' && ev.ctrlKey) {
                // Duplicate Node
                ev.preventDefault();
                selected_node.clone();
            } else if (ev.key === "Delete") {
                // Delete Node
                ev.preventDefault();
                canvas.remove_node(selected_node);
            }
        }

        if (selected_graph_path) {
            // Selected object is a GraphPath
            if (ev.key === "Delete") {
                // Delete GraphPath
                ev.preventDefault();
                canvas.remove_path(selected_graph_path);
                var link = selected_graph_path.link || null;
                if (link) {
                    // Remove link from source hook
                    var source_hook = link.this_hook;
                    var other_hook_ref = link.other_hook.get_ref();
                    // Remove link from target hook
                    var target_hook = link.other_hook;
                    var this_hook_ref = link.this_hook.get_ref();

                    delete source_hook.links[other_hook_ref];
                    delete target_hook.links[this_hook_ref];
                }
            }

        }
    }


    end_point_moved(end_point) {
        // check if connection is done
        let end_point_center = end_point.getCenterPoint();
        let neighbor_found = false;
        let target_found = false;


        for (let node_id in this.all_nodes) {
            // Loop over all nodes, looking for one that has a hook that is in
            // the endpoint's neighborhood
            let node = this.all_nodes[node_id];

            for (let h = 0; h < node.hooks.in.length; h++) {
                // Loop over all input hooks of the current node
                let target_hook = node.hooks.in[h];
                let target_hook_center = node.get_hook_center(target_hook);
                console.log(target_hook_center);

                // if (Math.abs(target_hook_center.x - end_point_center.x) < 10
                //     && Math.abs(target_hook_center.y - end_point_center.y) < 10) {
                if (target_hook.neighborhood(end_point_center)) {
                    console.log('END POINT IN' + node.caption + ' NEIGHBORHOOD');

                    neighbor_found = true;
                    let target_node = node;
                    let source_node = end_point.from_node;
                    let source_hook = end_point.from_hook;

                    if (source_hook.allow_connection(target_hook)) {
                        let target_found = true;
                        let link_already_exists = false;

                        // Check if hook types are compatible

                        this.clear_floating_endpoint();

                        // check that link  from  source_hook to target_hook does not exist already
                        link_already_exists = (target_hook.get_ref() in source_hook.links);

                        if (!link_already_exists) {
                            // Create a link from source_hook to target_hook
                            source_hook.add_link(target_hook);
                            target_hook.add_link(source_hook);
                            source_node.draw_links();
                            break;
                        }
                    }
                }
                if (neighbor_found) break;
            }
            if (target_found) break;
        }
    }

    get_nodes() {
        return this.all_nodes;
    };

    get_node_by_id(id) {
        return this.all_nodes[id];
    };

    get_edges() {

        let edges = [];
        for (let node_id in this.all_nodes) {
            let node = this.all_nodes[node_id];
            let output_hooks = node.hooks.out;
            for (let i_hook = 0; i_hook < output_hooks.length; i_hook++) {
                let hook = output_hooks[i_hook];
                let output_links = hook.links;
                for (let link_ref in output_links) {
                    let source_ref = hook.get_ref();
                    let target_ref = output_links[link_ref].other_hook.get_ref();
                    let edge = {
                        source: source_ref[0] + ':' + source_ref[1],
                        target: target_ref[0] + ':' + target_ref[1]
                    };
                    edges.push(edge)
                }
            }
        }
        return edges
    };


    get_selected_node() {
        var obj = this.getActiveObject();
        return typeof obj !== 'undefined' && obj.type === 'Node' ? obj : null;
    };

    get_object() {
        let graph_object = {
                'nodes': Object.values(this.all_nodes).map(node => node.to_object()),
                'edges': this.get_edges()
            }
        ;
        console.log(graph_object);
        return graph_object;
    };

    make_unique_id() {
        let i;
        for (i = 1; '#' + i in this.all_nodes; i++) {
        }
        return '#' + i;
    };

    add_node(options) {
        // check if there is an id
        options.id = options.id || this.make_unique_id();
        // check if id is indeed unique
        if (options.id in this.get_nodes()) {
            throw 'Duplicate node id';
        }
        // TODO: set top/left in a quite smart way
        // eg. if positions (top and left) are not defined
        // then take the center-weights of nodes centered?
        let node = new fabric.Node(options);
        // node._graphCanvas = this;
        this.all_nodes[options.id] = node;
        // Add node to canvas
        this.add(node);
        return node;
    };

    remove_node(node) {
        // Rempve from all_nodes
        delete this.all_nodes[node.id];

        // Remove links
        for (let hook_id in node.hooks_by_id) {
            let hook = node.hooks_by_id[hook_id];
            hook.remove_all_links();
        }
        // Eventually, remove floating endpoint
        if (this.floating_endpoint && this.floating_endpoint.from_node == node) {
            this.clear_floating_endpoint()
        }
        // Remove from canvas
        this.remove(node)
    };

    add_hook_to_node(node_id, hook_data) {

        let node = this.get_node_by_id(node_id);
        node.add_hook(hook_data);
    };

    draw_all_links() {
        for (let node_id in this.all_nodes) {
            console.log(this.all_nodes[node_id])
            this.all_nodes[node_id].draw_links();
        }
        // this.all_nodes.map(obj => obj.draw_links())
    };

    clear_floating_endpoint() {
        if (this.floating_endpoint) {
            this.remove(this.floating_endpoint);
            if (this.floating_endpoint.path) {
                this.remove(this.floating_endpoint.path);
            }
            this.floating_endpoint = null;
        }
    };

    delete_edge(source_hook, target_hook) {

    };

    add_path(pt1, pt2, link, options) {

        let graph_path = new fabric.GraphPath(pt1, pt2, link, options);
        this.add(graph_path);
        return graph_path;
    };


    remove_path(graph_path) {
        this.remove(graph_path)
    };


}


////////////////////////////////////////////////////////////////////////////////////////
// Node
////////////////////////////////////////////////////////////////////////////////////////

/**
 * Extends fabric.Group
 *
 * This class provides methods for ....
 *
 * The following events are provided: .....
 *
 */

fabric.Node = fabric.util.createClass(fabric.Group, {
    type: 'Node',
    initialize: function (options) {
        /**
         * @param {Object} [options]
         * @param {string} [options.id] - node's id
         * @param {int} [options.width] - node's body width
         */
        let default_options = {
            width: 150,
            height: 150,
            hooks: [{id: 'in', caption: 'in', io: 'in'}, //todo: remove bullet_options
                {id: 'out', caption: 'out', io: 'out'}],
            caption: '',
            orientation: 'horizontal', // else vertical //TODO: should be a canvas property
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
        this.create_body();
        this.create_caption();

        // create hooks
        // this.hooks_data = [];
        this.hooks = {in: [], out: []};
        this.hooks_by_id = {};
        console.log(this.options.hooks);
        this.define_hooks(this.options.hooks);
        console.log(this._objects);

        this.addWithUpdate();
        console.log(this._objects);

        // event handlers
        this.on('selected', function (options) {
            console.log('selected');

            var event = new CustomEvent('nodes.selected', {
                detail: {
                    node: this,
                    id: this.id,
                    caption: this.caption,
                    fill: this.body.fill,
                    width: this.body.width,
                    height: this.body.height,
                    json: JSON.stringify(this.to_object(), null, 2)
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

        this.on('mousedown', this.mouse_down);


        // this.set('dirty', true);
        this.setCoords();
        //
        this.setShadow({color: 'rgba(255,255,255,0.3)'});

        this.connect = function (hook_id, to_node) {
            var hook = this.get_hook_by_id(hook_id);
            hook.to_node = to_node;
        };

    },

    create_body: function () {
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

    create_caption: function () {
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

    get_hook_center: function (hook_arg) {
        // Get center point, in absolute coords, of hook bullet.
        // hook_arg may be a hook or a hook_id

        var hook, bullet_center, radius, node_center;
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

    reset_hooks: function () {
        // TODO: be more subtile: delete only connection that have been disturbed
        Object.values(this.hooks_by_id).map(hook => hook.remove_from_canvas());
        this.hooks = {in: [], out: []};
        this.hooks_by_id = {};
    },
    define_hooks: function (hooks_data) {
        // TODO: hooks_data should rather be a dict with key hook_id
        // this.hooks = hooks;
        this.max_hooks_positions = {top: 15, left: 15, right: 15, bottom: 15};

        for (let h = 0; h < hooks_data.length; h++) {
            hook_data = hooks_data[h];
            this.add_hook(hook_data);
        }
    },


    add_hook: function (options) {

        options.bullet_options = options.bullet_options || {};

        console.log(this);

        let hook = new Hook(
            options.id,
            this, // node
            options.caption,
            options.type,
            options.io,
            options.links_options,
            options.expects,
            options.provides);
        // let hook_data = {id: id, caption: hook.caption, type: hook.type, io: hook.io} // TODO: move that to a method 'to_object' in Hook class
        // this.hooks_data.push(hook_data);
        this.hooks_by_id[hook.id] = hook;
        this.hooks[options.io].push(hook);
        hook.create_bullet(options.bullet_options);
    },

    get_hook_by_id: function (hook_id) {
        if (!this.hooks_by_id.hasOwnProperty(hook_id)) {
            throw "Node has no hook with id " + hook_id;
        }
        return this.hooks_by_id[hook_id];
    },


    draw_links: function () {
        // Draw all links from hooks of this node
        let this_node = this;
        var canvas = this_node.canvas;

        var pt1, pt2;

        // draw link to floating endpoint ONLY if floating endpoint is attached to this node
        if (this.canvas.floating_endpoint && this.canvas.floating_endpoint.from_node == this_node) {
            let floating_endpoint = this.canvas.floating_endpoint;
            let source_hook = floating_endpoint.from_hook;
            let source_node = floating_endpoint.from_node;
            pt1 = source_hook.get_center();
            pt2 = floating_endpoint.getCenterPoint();
            // clean existing paths
            // this.clean_hook_paths(hook);
            // draw new path
            if (floating_endpoint.path) {
                this.canvas.remove(floating_endpoint.path);
            }
            console.log(source_hook.links_options)
            // floating_endpoint.path = this_node.draw_path(pt1, pt2, source_hook.links_options);
            floating_endpoint.path = canvas.add_path(pt1, pt2);
        }
        // Draw edges

        for (var hook_id in this_node.hooks_by_id) {
            var hook = this_node.hooks_by_id[hook_id];
            pt1 = hook.get_center();

            for (var hook_ref in hook.links) {       // hook.links is array with hook_ref as keys

                var link = hook.links[hook_ref];
                pt2 = link.other_hook.get_center();

                if (hook.io === 'in') {
                    // hook is of type 'in': find path via other hook
                    var other_hook = link.other_hook;
                    var link_from_other_hook = other_hook.links[hook.get_ref()];
                    // canvas.remove(link_from_other_hook.path);
                    // link_from_other_hook.path = this_node.draw_path(pt2, pt1, link.other_hook.links_options);
                    canvas.remove_path(link_from_other_hook.path);
                    link_from_other_hook.path = canvas.add_path(pt2, pt1, link);
                } else {
                    // hook is of type 'out': it holds the path
                    if (link.path) {
                        canvas.remove_path(link.path);
                    }
                    // link.path = this_node.draw_path(pt1, pt2, hook.links_options);
                    link.path = canvas.add_path(pt1, pt2, link);
                }
            }
        }
    },


    mouse_down: function (option) {
        console.log('node_mouse_down' + option.target.caption);
        let canvas = this.canvas;
        console.log(canvas.get_object());
        let target = option.target;

        if (option.subTargets && option.subTargets.length > 0) {
            // user has clicked on one object from Node 's objects
            let inner_target = option.subTargets[0];
            if (inner_target.type === 'hook-bullet') {
                // this object was indeed a hook bullet

                let hook_bullet = inner_target;
                let hook = hook_bullet.hook;

                if (option.e && option.e.ctrlKey === true) {
                    console.log('CONTROL CLICK ON BULLET');
                    // Ctrl-Click on bullet means remove all links
                    for (var hook_ref in hook.links) {       // hook.links is array with hook_ref as keys
                        var link = hook.links[hook_ref];
                        if (link.path) {
                            canvas.remove(link.path);
                        }
                        let other_hook = link.other_hook;
                        delete hook.links[hook_ref];
                        delete other_hook.links[hook.get_ref()];
                    }

                } else {
                    // Click without Ctrl key pressed:  create floating endpoint
                    console.log(inner_target);
                    let end_point;
                    if (hook.io === 'out') {

                        this.canvas.clear_floating_endpoint();

                        // Create a new endpoint

                        console.log(option);

                        let pt1 = this.get_hook_center(hook);

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

                            // stroke: 'red',
                            // strokeWidth: 2
                        });

                        this.canvas.add(end_point);
                        this.canvas.floating_endpoint = end_point;
                        // hook.to_node = end_point;
                        this.canvas.draw_all_links();

                    }

                }
            }
        }
    },


    to_object: function () {
        let hooks_data = [];
        for (hook_type in this.hooks) {
            hooks_by_type = this.hooks[hook_type]
            for (var i = 0; i < hooks_by_type.length; i++) {

                hook = hooks_by_type[i];
                hooks_data.push(hook.to_object())
            }
        }
        return {
            id: this.id,
            caption: this.caption,
            top: this.top,
            left: this.left,
            width: this.body.width,
            height: this.body.height,
            hooks: hooks_data,
        }
    },

    update: function (options) {
        options = JSON.parse((options));
        // id => CANNOT be changed, or?? @Pap?
        // caption
        if (options.caption) this.caption = options.caption
        // hooks
        // if hooks have been change

        // if this node is plugged, remove all connexions
        this.reset_hooks();
        this.define_hooks(options.hooks);

    },
    clone: function () {
        let json_obj = this.to_object();
        delete json_obj.id;
        json_obj.left += 50;
        json_obj.top += 50;
        console.log(json_obj);
        new_node = this.canvas.add_node(json_obj);
        this.canvas.setActiveObject(new_node); //New object becomes the selected object
    }
    ,


    setFill: function (fill) {
        this.body.set('fill', fill);
    }

})
;


class Hook {
    constructor(id, node, caption = '', type = 'default', io = 'out', links_options = {}, expects = null, provides = null) {
        /**
         * @param {Object} [options]
         * @param {string} [options.id] - hook id.
         * @param {fabric.Node} [options.node] - node that this hook belongs to
         * @param {string} [options.caption] - caption to print in front of the hook
         * @param {string} [options.io] - 'in' or 'out', defines if this hook is input or output of its node

         */
        this.id = id; //TODO check if unique
        this.node = node;
        this.caption = caption;
        this.type = type;
        this.io = io;
        this.links = {};
        this.links_options = links_options;
        console.log(this.links_options);
        this.provides = provides;
        this.expects = expects;
    }

    neighborhood(point, radius = 10) {
        let center = this.get_center();

        return (Math.abs(center.x - point.x) < radius
            && Math.abs(center.y - point.y) < radius);
    }

    allow_connection(hook) {
        if (!hook.expects) {
            // if expects is null, it accepts all types
            return true
        }
        // We only deal with output connections
        if (this.io === 'out') {
            //  If this is an output hook, check whether `hook` expects type
            //  than what this hook provides
            return hook.expects.includes(this.provides)
        } else {
            // If this is an input hook
            return true
        }

    }

    create_bullet(options) {
        /**
         * @param {Object} [options]
         * @param {int} [options.radius] -
         * @param {int} [options.strokeWidth] -
         * @param {string} [options.stroke] - color of stroke
         * @param {string} [options.fill] - color of fill
         */
        if (this.node.orientation === 'horizontal') {
            if (this.io === 'in') {
                this.side = 'left'
            } else {
                this.side = 'right'
            }
        } else { // this.orientation === 'horizontal'
            if (this.io === 'in') {
                this.side = 'top'
            } else {
                this.side = 'bottom'
            }
        }

        let default_options = {
            fill: '#444',
            stroke: '#222',
            radius: 5,
            strokeWidth: 1

        };
        this.options = Object.assign(default_options, options);

        if (this.side === 'right') {
            this.x = this.node.body.left + this.node.body.width;
            this.y = this.node.body.top + this.node.max_hooks_positions[this.side];
            this.caption_x = this.x - 12;
            this.caption_y = this.y;
        } else if (this.side === 'left') {
            this.x = this.node.body.left;
            this.y = this.node.body.top + this.node.max_hooks_positions[this.side]; // -this.body.height / 2 + this.max_hooks_positions[hook.side];
            this.caption_x = this.x + 12;
            this.caption_y = this.y;
        } else if (this.side === 'top') {
            this.x = this.node.body.left + this.node.max_hooks_positions[this.side];
            this.y = this.node.body.top;
            this.caption_x = this.x;
            this.caption_y = this.y + 12;
        } else if (this.side === 'bottom') {
            this.x = this.node.body.left + this.node.max_hooks_positions[this.side];
            this.y = this.node.body.top + this.node.height; // -this.body.height / 2 + this.max_hooks_positions[hook.side];
            this.caption_x = this.x;
            this.caption_y = this.y - 12;
        } else {
            throw "Bullet side is erroneous: " + this.side;
        }
        this.node.max_hooks_positions[this.side] += 15; // increment max_hooks_positions

        this.bullet = new fabric.Circle({
            node: this.node,
            name: 'bullet',
            type: 'hook-bullet',
            hook: this,
            hook_id: this.id,
            originX: 'center',
            originY: 'center',
            top: this.y,
            left: this.x,
            radius: this.options.radius,
            fill: this.options.fill,
            hoverCursor: 'pointer',
            stroke: this.options.stroke,
            strokeWidth: this.options.strokeWidth
        });

        this.text = new fabric.Text(this.caption, {
            name: 'hook-caption',
            type: 'hook-caption',
            fontFamily: 'Arial', fontSize: 10, fill: '#222', fontStyle: 'normal',
            originX: this.side,
            originY: 'center',
            top: this.caption_y, left: this.caption_x,
            width: 20, height: 20
        });

        this.node.add(this.text);
        this.text.setCoords();

        this.node.add(this.bullet);
        this.bullet.setCoords();

        this.node.addWithUpdate();
        this.node.setCoords();

        console.log("add_hook: " + this.node._objects);
        console.log(this.node.hooks_by_id);

    }

    remove_from_canvas() {
        this.remove_all_links();
        this.node.remove(this.text);
        this.node.remove(this.bullet);

    }

    get_ref() {
        return [this.node.id, this.id];
    }

    add_link(other_hook) {
        var other_hook_ref = other_hook.get_ref();
        if (other_hook_ref in this.links) {
            console.log("Warning: link already exists to target " + other_hook_ref);
            this.remove_link(other_hook);
        }
        this.links[other_hook_ref] = {
            this_hook: this,
            other_hook: other_hook,
            path: null
        };
    }

    remove_link(other_hook) {
        var other_hook_ref = other_hook.get_ref();
        if (other_hook_ref in this.links) {
            var link = this.links[other_hook_ref];
            if (link.path) {
                this.node.canvas.remove(link.path);
            }
            delete this.links[other_hook_ref];
        }
    }

    remove_all_links() {
        for (const [key, link] of Object.entries(this.links)) {
            if (this.io === 'in') {
                // Remove its output links by removing their reference in the next
                link.other_hook.remove_link(this)
            } else {
                // Remove its input links by removing their reference in the previous
                link.other_hook.remove_link(this)

            }
        }

    }

    get_center() {
        var node = this.node;
        var center = node.get_hook_center(this);
        return center;
    }


    to_object() {
        let hook_object =
            {
                id: this.id,
                caption: this.caption,
                type: this.type,
                io: this.io,
                provides: this.provides,
                links_options: this.links_options,
                bullet_options: this.options
            };
        return hook_object

    }
};


fabric.GraphPath = fabric.util.createClass(fabric.Path, {
    type: 'GraphPath',
    initialize: function (pt1, pt2, link, options) {
        /**
         * @param pt1   Origin point
         * @param pt2   Destination point
         * @param link  The link object to which this path relates (optional)
         * @param options
         */

        let default_options = {
            link: typeof link !== 'undefined' ? link : null,
            fill: null,
            stroke: 'black',
            opacity: 0.5,
            strokeWidth: 2,
            selectable: true,
            hoverCursor: 'default',
            hasControls: false,
            hasBorders: false,
            perPixelTargetFind: true,
            targetFindTolerance: 12,
            lockMovementX: true,
            lockMovementY: true
        };
        this.options = Object.assign(default_options, options);

        // draw new one
        let svg_path = this.make_svg_path(pt1, pt2);
        // let new_path = new fabric.Path(svg_path, this.path_options);


        // calls the parent's constructor
        this.callSuper('initialize', svg_path, this.options);


        // event handlers
        this.on('selected', function (options) {
            if (this.link) {
                // If it represents an actual link (not a path to floating endpoint)
                // otherwise there is no need to select
                // this.set('strokeWidth', 5);
                this.set('shadow', {color: 'rgba(0,0,0,1)', offsetX: 0, offsetY: 0, blur: 4});
                console.log('selected');
            }
        });

        this.on('deselected', function (options) {
            // this.set('strokeWidth', this.options.strokeWidth);
            this.set('shadow', null);
            console.log('deselected');
        });

    },


    make_svg_path: function (pt1, pt2) {
        var v = 0, d = 0, min_d, max_d, xd, yd, svg_path;

        xd = Math.abs(pt2.x - pt1.x);
        yd = Math.abs(pt2.y - pt1.y);

        d = xd * 0.8;

        min_d = xd + yd;
        max_d = 100;

        d = Math.min(Math.max(d, min_d), max_d);

        // if endpoint is almost on same vertical position as startpoint, then tweak points so that path is not flat
        if (pt2.x < pt1.x && Math.abs(pt2.y - pt1.y) < 30) {
            v = (30 - Math.abs(pt2.y - pt1.y)) * (pt2.y > pt1.y ? -1 : -1);
        }

        svg_path = 'M ' + pt1.x + ' ' + pt1.y
            + ' C ' + (pt1.x + d) + ' ' + (pt1.y + v) + ' ' + (pt2.x - d) + ' ' + (pt2.y + v) + ' ' + pt2.x + ' ' + pt2.y;

        // console.log(svg_path);
        return svg_path;
    }


});
