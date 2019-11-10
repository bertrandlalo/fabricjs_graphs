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
        this.all_edges = {};
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

    // to_objects: graph_toObject

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
        node._graphCanvas = this;
        this.all_nodes[options.id] = node;
        // Add node to canvas
        this.add(node);
        return node
    };

    add_hook_to_node(node_id, hook_data) {
        let node = this.get_node_by_id(node_id);
        node.add_hook(hook_data);
    }
};

// fabric.Object.prototype.transparentCorners = false;

// var canvas = this.__canvas = new fabric.Canvas('node-canvas', {
//     backgroundColor: '#eee',
//     HOVER_CURSOR: 'pointer'
// });

// var canvas_element = document.getElementById('node-canvas');
//
// canvas_element.graphApi = {
//     get_nodes: function () {
//         return all_nodes;
//     },
//     get_edges: function () {
//         return all_edges;
//     },
//     get_canvas: function () {
//         return canvas;
//     },
//     get_selected_node: function () {
//         var obj = canvas.getActiveObject();
//         return obj.type === 'Node' ? obj : null;
//     },
//     to_objects: graph_toObject
// };

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

        this.width = options.width || 100;
        this.height = options.height || 100;
        this.id = options.id || make_unique_id();
        // TODO: ADD THIS IN GRAPH
        // if (this.id in all_nodes) {
        //     throw 'Duplicate node id';
        // }
        // all_nodes[this.id] = this;

        // extend options with fabric properties
        $.extend(options,
            {
                originX: 'left',
                originY: 'top',
                subTargetCheck: true,
                lockScalingX: true,
                lockScalingY: true,
                // lockUniScaling: true,
                hasRotatingPoint: false,
                hoverCursor: 'default',
                cornerSize: 0,
            });

        // calls the parent's constructor
        this.callSuper('initialize', [], options);

        // TODO: remove this useless line copy-pasted from ??
        // this.set('customAttribute', options.customAttribute || 'undefinedCustomAttribute');

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
            fill: options.fill || "#ddd",
            stroke: '#444',
            fillRule: "nonzero",
            shadow: {color: 'rgba(0,0,0,0.3)', offsetX: 5, offsetY: 5, blur: 5}
        });


        this.add(this.body);

        this.caption_object = new fabric.Text(options.caption, {
            originX: 'center',
            originY: 'center',
            fontFamily: 'Arial',
            fontSize: 18,
            fontStyle: 'bold',
            top: this.body.height / 3,
            left: this.body.width / 2,
            fill: 'red',
            stroke: null
        });

        this.add(this.caption_object);

        // this.getCoords();
        // this.addWithUpdate();

        this.hooks_data = [];
        this.hooks = [];
        this._hooks_by_id = {};


        this.define_hooks(options.hooks_data || []);
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
                    json: JSON.stringify(this.toJSON(), null, 2)
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

        this.on('mousedown', this.node_mouse_down);


        // this.set('dirty', true);
        this.setCoords();
        //
        this.setShadow({color: 'rgba(255,255,255,0.3)'});

        this.connect = function (hook_id, to_node) {
            var hook = this.getHookById(hook_id);
            hook.to_node = to_node;
        };

    },

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
        radius = (hook.side == 'left' ? -hook.radius : hook.radius);
        return {
            x: node_center.x + bullet_center.x + radius,
            y: node_center.y + bullet_center.y
        };
    },


    define_hooks: function (hooks_data) {
        // this.hooks = hooks;
        this.max_hooks_positions = {top: 15, left: 15, right: 15, bottom: 15};
        for (let h = 0; h < hooks_data.length; h++) {
            this.add_hook(hooks_data[h]);
        }
    },


    add_hook: function (hook_data) {
        this.hooks_data.push(hook_data);
        console.log(this);
        console.log(hook_data);
        hook = {
            side: hook_data.side || 'right',
            radius: hook_data.radius || 5,
            caption: hook_data.caption || '',
            fill: hook_data.fill || '#444',
            out: hook_data.out || true,
            id: hook_data.id  //todo: check id unique
        };

        if (hook.side == 'right') {
            hook.x = this.body.left + this.body.width;
            hook.y = this.body.top + this.max_hooks_positions[hook.side];
            hook.caption_x = hook.x - 12;
            hook.caption_y = hook.y;
        } else if (hook.side == 'left') {
            hook.x = this.body.left;
            hook.y = this.body.top + this.max_hooks_positions[hook.side]; // -this.body.height / 2 + this.max_hooks_positions[hook.side];
            hook.caption_x = hook.x + 12;
            hook.caption_y = hook.y;
        }
        // if (hook.side == 'right') {
        //     hook.x = this.body.width / 2;
        //     hook.y = -this.body.height / 2 + this.max_hooks_positions[hook.side];
        //     hook.caption_x = hook.x - 12;
        //     hook.caption_y = hook.y;
        // } else if (hook.side == 'left') {
        //     hook.x = -this.body.width / 2;
        //     hook.y = -this.body.height / 2 + this.max_hooks_positions[hook.side];
        //     hook.caption_x = hook.x + 12;
        //     hook.caption_y = hook.y;
        // }
        // Will see later
        // else if (hook.side == 'top') {
        //     hook.y = -this.height/2 + hook.radius;
        //     hook.x = -this.width / 2 + this.max_hooks_positions[hook.side];
        // }
        // else if (hook.side == 'bottom') {
        //     hook.y = this.height/2 + hook.radius;
        //     hook.x = -this.width / 2 + this.max_hooks_positions[hook.side];
        // }
        else {
            throw "Hook side is erroneous: " + hook.side;
        }

        this.max_hooks_positions[hook.side] += 15;

        hook.bullet = new fabric.Circle({
            node: this,
            name: 'bullet',
            type: 'hook-bullet',
            hook: hook,
            hook_id: hook.id,
            originX: 'center',
            originY: 'center',
            top: hook.y,
            left: hook.x,
            radius: hook.radius,
            fill: hook.fill,
            hoverCursor: 'pointer',
            stroke: '#222',
            strokeWidth: 1
        });

        // hook.bullet.setCoords();            // Don't know why, but without this, bullet.oCoords is null and fails in containtsPoint()
        // this._objects.push(hook.bullet);

        var text = new fabric.Text(hook.caption, {
            name: 'hook-caption',
            type: 'hook-caption',
            fontFamily: 'Arial', fontSize: 10, fill: '#222', fontStyle: 'normal',
            originX: 'center', originY: 'center',
            top: hook.caption_y, left: hook.caption_x,
            width: 20, height: 20
        });

        // this._objects.push(text);
        this.add(text);
        text.setCoords();

        this.add(hook.bullet);
        hook.bullet.setCoords();

        this.addWithUpdate();
        this.setCoords();

        this._hooks_by_id[hook_data.id] = hook;
        this.hooks.push(hook);

        console.log("add_hook: " + this._objects);
        console.log(this._hooks_by_id);
        // canvas.bringToFront(hook.bullet);
        // this.addWithUpdate();

    },


    getHookById: function (hook_id) {
        if (!this._hooks_by_id.hasOwnProperty(hook_id)) {
            throw "Node has no hook with id " + hook_id;
        }
        return this._hooks_by_id[hook_id];
    },


    draw_links: function () {
        // Draw all links from hooks of this node
        var this_node = this;
        $.each(this.hooks, function (i, hook) {
            if (hook.out && hook.to_node) {
                var pt1, pt2;
                pt1 = this_node.get_hook_center(hook);
                if (hook.to_node.type == 'end_point') {
                    pt2 = hook.to_node.getCenterPoint();
                } else {
                    pt2 = hook.to_node.get_hook_center('in');
                }
                canvas.remove(hook.path);
                var svg_path = this_node.make_svg_path(pt1, pt2);
                var new_path = new fabric.Path(svg_path, {
                    fill: null,
                    stroke: 'green',
                    opacity: 0.5,
                    strokeWidth: 2,
                    selectable: false,
                    hoverCursor: 'default'
                });
                hook.path = new_path;
                canvas.add(new_path);
                new_path.sendToBack();
            }
        });
    },


    node_mouse_down: function (option) {
        console.log('node_mouse_down' + option.target.caption);

        var target = option.target;
        if (option.subTargets && option.subTargets.length > 0) {
            var inner_target = option.subTargets[0];
            if (inner_target.type == 'hook-bullet') {
                var hook_bullet = inner_target;
                var hook = hook_bullet.hook;
                var end_point;

                if (hook.to_node && hook.to_node.type == 'end_point') {
                    // Node already attached to 'floating' endpoint: remove it
                    canvas.remove(hook.path);
                    canvas.remove(hook.to_node);
                    hook.path = null;
                    hook.to_node = null;
                } else {
                    // Create a new endpoint

                    console.log(hook)
                    var pt1 = this.get_hook_center(hook);

                    end_point = new fabric.Circle({
                        type: 'end_point',
                        name: 'end_point',
                        originX: 'center',
                        originY: 'center',
                        top: pt1.y + 5,
                        left: pt1.x + 25,
                        radius: 5,
                        fill: 'grey',
                        hasControls: false,
                        hasBorders: false,
                        from_hook: hook,
                        from_node: target,
                        hoverCursor: 'default',

                        // stroke: 'red',
                        // strokeWidth: 2
                    });

                    canvas.add(end_point);
                    hook.to_node = end_point;
                    draw_all_links();
                }
            }
        }
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
    },


    toJSON: function () {
        return {
            id: this.id,
            caption: this.caption,
            text: this.text,
            top: this.top,
            left: this.left,
            hooks_data: this.hooks_data,
        }

    },


    clone: function () {
        var json_obj = this.toJSON();
        json_obj.id = make_unique_id();
        json_obj.left += 50;
        json_obj.top += 50;
        var new_node = new fabric.Node(json_obj);
        canvas.add(new_node);
        canvas.setActiveObject(new_node);
    },


    setFill: function (fill) {
        this.body.set('fill', fill);
    }


});

