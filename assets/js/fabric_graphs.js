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
        this.all_edges = [];
        //////////////
        // Custom event listeners
        //////////////
        this.on('object:moving', this.draw_all_links);
        this.on('mousedown', function (options) {
            console.log('mouse:down ' + options.target.type);
            var coords = options.target.getLocalPointer();
            var x_abs = coords.x / options.target.scaleX;
            var y_abs = coords.y / options.target.scaleY;
            console.log('coordinates ' + x_abs + ', ' + y_abs);
        });


        // Do drag
        this.on('mouse:move', function (opt) {
            if (this.isDragging) {
                var e = opt.e;
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
            // console.log('object:moved ' + options.target.type);
            this.draw_all_links();

            if (options.target.type == 'end_point') {
                // check if connection is done
                var end_point = options.target;
                var end_point_center = options.target.getCenterPoint();


                for (let node_id in this.all_nodes) {
                    let node = this.all_nodes[node_id];
                    let in_hook_center = node.get_hook_center('in');
                    console.log(node.getCenterPoint());
                    console.log(in_hook_center);
                    if (Math.abs(in_hook_center.x - end_point_center.x) < 10 && Math.abs(in_hook_center.y - end_point_center.y) < 10) {
                        console.log('CONNECT TO ' + node.caption);
                        var from_node = end_point.from_node;
                        var from_hook = end_point.from_hook;
                        from_hook.to_node = node;
                        this.remove(end_point);
                        from_node.draw_links();
                        console.log(from_hook);
                        let edge = {
                            'source': {
                                'node_id': from_node.id,
                                'hook_id': from_hook.id

                            },
                            'target': {
                                'node_id': node.id,
                                'hook_id': node.getHookById('in').id

                            },

                        };
                        this.all_edges.push(edge);
                        break;
                    }
                }
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

    get_nodes() {
        return this.all_nodes;
    };

    get_node_by_id(id) {
        return this.all_nodes[id];
    };

    get_edges() {
        return this.all_edges;
    };

    get_selected_node() {
        var obj = this.getActiveObject();
        return obj.type === 'Node' ? obj : null;
    };

    get_object() {
        let graph_object = {
                'nodes': this.all_nodes,
                'edges': this.all_edges
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
        console.log(options);
        let node = new fabric.Node(options);
        // node._graphCanvas = this;
        this.all_nodes[options.id] = node;
        // Add node to canvas
        this.add(node);
        return node
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

};


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
            width: 100,
            height: 100,
            hooks: [],
            caption: '',
            fill: 'white',
            // extend options with fabric properties
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

        this.define_hooks(this.options.hooks);
        console.log(this._objects);

        this.addWithUpdate();
        console.log(this._objects);

        // event handlers
        this.on('selected', function (options) {
            // if (this.body.containsPoint(options.e))
            //     console.log('AAAAA');
            // console.log(e.target.top, e.target.left);
            // this.body.set('fill', '#fff');
            console.log('selected');


            var event = new CustomEvent('nodes.selected', {
                detail: {
                    node: this,
                    id: this.id,
                    caption: this.caption,
                    fill: this.body.fill,
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

        this.on('mousedown', this.mouse_down);


        // this.set('dirty', true);
        this.setCoords();
        //
        this.setShadow({color: 'rgba(255,255,255,0.3)'});

        this.connect = function (hook_id, to_node) {
            var hook = this.getHookById(hook_id);
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
            width: 150,
            height: 150,
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
                fill: 'red',
                stroke: null
            }
        );
        this.add(this.caption_object);
    }
    ,
    get_hook_center: function (hook_arg) {
        // Get center point, in absolute coords, of hook bullet.
        // hook_arg may be a hook or a hook_id

        var hook, bullet_center, radius, node_center;
        if (typeof hook_arg == "object") {
            hook = hook_arg;
        } else {
            hook = this.getHookById(hook_arg);
        }

        bullet_center = hook.bullet.getCenterPoint();
        node_center = this.getCenterPoint();
        radius = (hook.side === 'left' ? -hook.bullet.radius : hook.bullet.radius);
        return {
            x: node_center.x + bullet_center.x + radius, //node_center.x
            y: node_center.y + bullet_center.y //node_center.y
        };
    }
    ,


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

        let hook = new Hook(options.id, this,
            options.caption,
            options.type,
            options.io);
        // let hook_data = {id: id, caption: hook.caption, type: hook.type, io: hook.io} // TODO: move that to a method 'toObject' in Hook class
        // this.hooks_data.push(hook_data);
        this.hooks_by_id[hook.id] = hook;
        this.hooks[options.io].push(hook);
        hook.create_bullet(options.bullet_options);

    },

    getHookById: function (hook_id) {
        if (!this.hooks_by_id.hasOwnProperty(hook_id)) {
            throw "Node has no hook with id " + hook_id;
        }
        return this.hooks_by_id[hook_id];
    },


    draw_links: function () {
        // Draw all links from hooks of this node
        let this_node = this;
        $.each(this.hooks.out, function (i, hook) {
            if (hook.io === 'out' && hook.to_node) {
                let pt1, pt2;
                pt1 = this_node.get_hook_center(hook);
                if (hook.to_node.type == 'end_point') {
                    pt2 = hook.to_node.getCenterPoint();
                } else {
                    pt2 = hook.to_node.get_hook_center('in');
                }
                console.log(this_node);
                this_node.canvas.remove(hook.path);
                let svg_path = this_node.make_svg_path(pt1, pt2);
                let new_path = new fabric.Path(svg_path, {
                    fill: null,
                    stroke: 'green',
                    opacity: 0.5,
                    strokeWidth: 2,
                    selectable: false,
                    hoverCursor: 'default'
                });
                console.log(new_path);
                hook.path = new_path;
                this_node.canvas.add(new_path);
                new_path.sendToBack();
            }
        });
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
                console.log(inner_target);
                let hook_bullet = inner_target;
                let hook = hook_bullet.hook;
                let end_point;
                if (hook.io === 'out') {
                    if (hook.to_node && hook.to_node.type === 'end_point') {
                        // Node already attached to 'floating' endpoint: remove it
                        console.log('Removing end point' + hook)
                        canvas.remove(hook.path);
                        canvas.remove(hook.to_node);
                        hook.path = null;
                        hook.to_node = null;
                    } else {
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
                            fill: 'red',
                            hasControls: false,
                            hasBorders: false,
                            from_hook: hook,
                            from_node: target,
                            hoverCursor: 'default',

                            // stroke: 'red',
                            // strokeWidth: 2
                        });

                        this.canvas.add(end_point);
                        hook.to_node = end_point;
                        this.canvas.draw_all_links();
                    }

                }

            }
        }
    }
    ,


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
    },

    toObject: function () {
        let hooks_data = [];
        for (hook_type in this.hooks) {
            hooks_by_type = this.hooks[hook_type]
            for (var i = 0; i < hooks_by_type.length; i++) {

                hook = hooks_by_type[i];
                hooks_data.push(hook.toObject())
            }
        }
        return {
            id: this.id,
            caption: this.caption,
            top: this.top,
            left: this.left,
            hooks: hooks_data,
        }

    },

    clone: function () {
        let json_obj = this.toObject();
        delete json_obj.id;
        json_obj.left += 50;
        json_obj.top += 50;
        // var new_node = new fabric.Node(json_obj);
        console.log(json_obj);
        new_node = this.canvas.add_node(json_obj);
        // t.add(new_node);
        this.canvas.setActiveObject(new_node); //TODO: why this? @Pap.
    }
    ,


    setFill: function (fill) {
        this.body.set('fill', fill);
    }

})
;


class Hook {
    constructor(id, node, caption = '', type = 'default', io = 'out') {
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
    }

    create_bullet(options) {
        /**
         * @param {Object} [options]
         * @param {string} [options.side] - 'left' or 'right', defines the bullet side.
         * @param {int} [options.radius] -
         * @param {int} [options.strokeWidth] -
         * @param {string} [options.stroke] - color of stroke
         * @param {string} [options.fill] - color of fill
         */
        let default_side = 'right';
        if (this.io === 'in') {
            default_side = 'left'
        }

        let bullet_side = options.side || default_side;

        if (bullet_side === 'right') {
            this.x = this.node.body.left + this.node.body.width;
            this.y = this.node.body.top + this.node.max_hooks_positions[bullet_side];
            this.caption_x = this.x - 12;
            this.caption_y = this.y;
        } else if (bullet_side === 'left') {
            this.x = this.node.body.left;
            this.y = this.node.body.top + this.node.max_hooks_positions[bullet_side]; // -this.body.height / 2 + this.max_hooks_positions[hook.side];
            this.caption_x = this.x + 12;
            this.caption_y = this.y;
        } else {
            throw "Bullet side is erroneous: " + bullet_side;
        }
        this.node.max_hooks_positions[bullet_side] += 15; // increment max_hooks_positions

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
            radius: options.radius || 5,
            fill: options.fill || '#444',
            hoverCursor: 'pointer',
            stroke: options.stroke || '#222',
            strokeWidth: options.strokeWidth || 1
        });

        let text = new fabric.Text(this.caption, {
            name: 'hook-caption',
            type: 'hook-caption',
            fontFamily: 'Arial', fontSize: 10, fill: '#222', fontStyle: 'normal',
            originX: 'center', originY: 'center',
            top: this.caption_y, left: this.caption_x,
            width: 20, height: 20
        });

        this.node.add(text);
        text.setCoords();

        this.node.add(this.bullet);
        this.bullet.setCoords();

        this.node.addWithUpdate();
        this.node.setCoords();

        console.log("add_hook: " + this.node._objects);
        console.log(this.node.hooks_by_id);

    }

    toObject() {
        let hook_object =
            {
                id: this.id,
                caption: this.caption,
                type: this.type,
                io: this.io
            };
        return hook_object

    }
};


