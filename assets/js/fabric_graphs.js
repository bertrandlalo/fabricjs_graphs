////////////////////////////////////////////////////////////////////////////////////////
// Graph
////////////////////////////////////////////////////////////////////////////////////////
class Graph {
    constructor(id, acyclic) {
        /**
         * @param {Object} [options]
         * @param {string} [options.id] - hook id.
         * @param {fabric.Node} [options.node] - node that this hook belongs to
         * @param {string} [options.caption] - caption to print in front of the hook
         * @param {string} [options.io] - 'in' or 'out', defines if this hook is input or output of its node

         */
        this.last_id = 0;
        this.id = id; //TODO check if unique
        this.isAcyclic = acyclic;
        this.nodes = [];
    }

    addNode(node) {
        this.nodes.push(node)
    };

    removeNode(node) {
        this.nodes.remove(node)
        //    todo: delete edges
    };

    numberOfNodes() {
        return this.nodes.length;
    }

    order() {
        return this.nodes.length;
    }

    generateID() {
        return this.last_id + 1
    }

    listEdgesRefs() {

        let edges_refs = [];
        this.nodes.forEach(node => {
            node.hooks.out.forEach(hook => {
                let output_edges = hook.edges;
                output_edges.forEach(edge => {
                    let this_hook = edge.this_hook;
                    let other_hook = edge.other_hook;

                    let edge_ref = {
                        source: this_hook.node.id + ':' + this_hook.id,
                        target: other_hook.node.id + ':' + other_hook.id
                    };
                    edges_refs.push(edge_ref)
                })
            })
        });
        return edges_refs

    };

    toObject() {
        let graph_object = {
                'nodes': this.nodes.map(node => node.to_object()),
                'edges': this.listEdgesRefs()
            }
        ;
        console.log(graph_object);
        // console.log(this.get_indegrees());
        // console.log(this.sort_graph());
        return graph_object;
    }

    nodesIter(optData = false) {
        if (optData) {
            return toIterator(this.nodes);
        }
        return this.nodes.keys();
    }

}

////////////////////////////////////////////////////////////////////////////////////////
// Canvas
////////////////////////////////////////////////////////////////////////////////////////

/**
 * Extends fabric.Canvas
 *
 * The following methods are provided:
 *   - handle_keydown
 *   - endpoint_moved
 *   - get_nodes, get_edges, get_selected_node
 *   - to_object
 *   - make_unique_id
 *   - draw_all_links
 *   - clear_floating_endpoint
 *   - add_node, remove_node
 *   - add_path, remove_path
 *
 *
 * The following events are provided:
 *   - object:moving
 *   - mouse:down
 *   - mouse:move
 *   - mouse:up
 *   - object:moved
 *   - object:selected
 *   - mouse:wheel
 *
 */


class GraphCanvas extends fabric.Canvas {
    constructor(container_id, options) {
        super(container_id);

        // this.graph = new jsnx.MultiDiGraph(); // or DiGraph, MultiGraph, MultiDiGraph, etc
        // this.all_nodes = {};
        this.floating_endpoint = null;

        this.hook_types = options.hook_types;

        this.graph = new Graph(container_id, options.acyclic || true);

        //////////////
        // Custom event listenersancestors = source_node.getAncestors()
        //////////////
        // this.on('object:moving', this.draw_all_links);
        this.on('object:moving', function (options) {
            console.log('object:moving ' + options.target.type);
            if (options.target.type === 'Node') {
                // Moving object is a node, redraw all links from this node (should be to AND from)
                options.target.drawEdges();
            }
            if (options.target.type === 'end_point') {
                var end_point = options.target;
                var node = end_point.from_node;
                node.drawEdges();
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
                options.target.drawEdges();
            } else if (options.target.type === 'end_point') {
                var end_point = options.target;
                this.endpoint_moved(end_point);
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

        if (!obj)
            return;

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

    endpoint_moved(end_point) {
        // check if connection is done
        let end_point_center = end_point.getCenterPoint();
        let neighbor_found = false;
        let target_found = false;


        for (let node of this.graph.nodes) {
            // Loop over all nodes, looking for one that has a hook that is in
            // the endpoint's neighborhood

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
                        // link_already_exists = (target_hook.get_ref() in source_hook.links);
                        link_already_exists = source_hook.edges.some(edge => edge.other_hook == target_hook);


                        if (!link_already_exists) {
                            // Create a link from source_hook to target_hook
                            source_hook.addEdge(target_hook);
                            target_hook.addEdge(source_hook);

                            source_node.drawEdges();
                            break;
                        }
                    }
                }
                if (neighbor_found) break;
            }
            if (target_found) break;
        }
    }

    get_indegrees() {
        //  indegree_map = {};
        let indegrees = [];
        Object.entries(this.graph.nodes).forEach(
            ([id, node]) => indegrees.push({id: id, degree: node.get_ancestors().length || 0})//indegree_map[id] = node.descendants.length || 0
        );
        console.log(indegrees);
        return indegrees
    };

    sort_graph() {
        let sorted_nodes = [];
        // let indegrees = this.get_indegrees();
        //     # These nodes have zero indegree and ready to be returned.
        let indegrees = this.get_indegrees().filter(indegree => indegree.degree > 0)
        let zero_indegrees = this.get_indegrees().filter(indegree => indegree.degree === 0).map(indegree => indegree.id);

        while (zero_indegrees.length > 0) {
            console.log(zero_indegrees)

            let node_id = zero_indegrees.pop();
            let node = this.graph.nodes[node_id];
            let descendants = node.get_descendants();
            descendants.forEach(
                child => {
                    console.log(child.caption);
                    indegrees[child.id] -= 1;
                    if (indegrees[child.id] == 0) {
                        zero_indegrees.push(child.id);
                        console.log(child.caption + 'pushed to zero_indegrees')

                        delete indegrees[child.id]
                        console.log(child.caption + 'deleted from indegrees')
                    }
                }
            );
            sorted_nodes.push(this.graph.nodes[node_id]);
        }
        return sorted_nodes;
    };


    // for (let [node_id, degree] of Object.entries(indegree_map)) {
    // }

    //for v, d in G.in_degree() if d == 0]
    //
    // while zero_indegree:
    //     node = zero_indegree.pop()
    //     if node not in G:
    //         raise RuntimeError("Graph changed during iteration")
    //     for _, child in G.edges(node):
    //         try:
    //             indegree_map[child] -= 1
    //         except KeyError:
    //             raise RuntimeError("Graph changed during iteration")
    //         if indegree_map[child] == 0:
    //             zero_indegree.append(child)
    //             del indegree_map[child]

    // };

    // };
    // get_nodes() {
    //     return this.all_nodes;
    // };

    //

    get_selected_node() {
        var obj = this.getActiveObject();
        return typeof obj !== 'undefined' && obj.type === 'Node' ? obj : null;
    };


    add_node(options) {
        // check if there is an id
        // options.id = options.id || this.make_unique_id();
        options.id = this.graph.generateID();
        // check if id is indeed unique
        // if (options.id in this.get_nodes()) {
        //     throw 'Duplicate node id';
        // }
        // TODO: set top/left in a quite smart way
        // eg. if positions (top and left) are not defined
        // then take the center-weights of nodes centered?
        let node = new fabric.Node(canvas, options);
        // node._graphCanvas = this;
        this.graph.addNode(node);
        // this.all_nodes[options.id] = node;
        // Add node to canvas
        this.add(node);

        // JSNETWORKX -------
        // node.order = this.graph.order();
        // this.graph.addNode(this.graph.order(), node.to_object());
        // console.log('Add node to graph --> ' + this.graph.numberOfNodes());
        // ------------------
        return node;
    };

    remove_node(node) {
        // Rempve from all_nodes
        // delete this.all_nodes[node.id];
        // Remove from graph
        this.graph.removeNode(node);

        // Remove links
        for (let hook_id in node.hooks_by_id) {
            let hook = node.hooks_by_id[hook_id];
            hook.removeEdges();
        }
        // Eventually, remove floating endpoint
        if (this.floating_endpoint && this.floating_endpoint.from_node == node) {
            this.clear_floating_endpoint()
        }
        // Remove from canvas
        this.remove(node);

        this.graph.removeNode()
        // JSNETWORKX -------
        // remove from graph
        // this.graph.removeNode(node.order);
        // console.log(this.graph.numberOfNodes())
        // ------------------
    };

    drawFloatingPath() {

        let pt1, pt2;

        // draw link to floating endpoint ONLY if floating endpoint is attached to this node
        // if (canvas.floating_endpoint && canvas.floating_endpoint.from_node == this) {
        let floating_endpoint = this.floating_endpoint;
        let source_hook = floating_endpoint.from_hook;
        let source_node = floating_endpoint.from_node;
        pt1 = source_hook.get_center();
        pt2 = floating_endpoint.getCenterPoint();
        // clean existing paths
        // this.clean_hook_paths(hook);
        // draw new path
        if (floating_endpoint.path) {
            this.remove(floating_endpoint.path);
        }
        console.log(source_hook.links_options);
        // floating_endpoint.path = this_node.draw_path(pt1, pt2, source_hook.links_options);
        floating_endpoint.path = this.add_path(pt1, pt2);
        floating_endpoint.bringToFront();
        // }
    };

    drawEdges() {
        console.log('drawEdges! ')
        // for (let node of this.graph.nodesIter(true)) {
        for (let node of this.graph.nodes) {
            // this.graph.nodes[node_id].draw_links();
            node.drawEdges();
        }
        if (this.floating_endpoint) {
            this.floating_endpoint.bringToFront();
        }

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
    initialize: function (canvas, options) {
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
        this.canvas = canvas;
        this.graph = canvas.graph;
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
    getParents() {

        let this_node = this;
        let parents = [];

        for (let [_, hook] of this_node.hooks.in.entries()) {
            if (hook.links) {
                Object.keys(hook.links).forEach(function (link_ref) {
                    let link = hook.links[link_ref];
                    parents.push(link.other_hook.node);
                });
            }
        }
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
        if (this.graph.isAcyclic) {
            let ancestors = source_node.getAncestors();
            return !(ancestors.includes(target_node));
        }
        return true
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

        if (options.type && this.canvas.hook_types && options.type in this.canvas.hook_types) {
            var hook_type_options = this.canvas.hook_types[options.type];
            options.io = options.io || hook_type_options.io;
            options.expects = options.expects || hook_type_options.expects;
            options.provides = options.provides || hook_type_options.provides;
            options.links_options = options.links_options || hook_type_options.links_options;
            options.bullet_options = options.bullet_options || hook_type_options.bullet_options;
            options.bullet_options.fill = hook_type_options.color;
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
    }
    ,
    // todo: remove those and usagee


    drawEdges() {

        // Draw all links from hooks of this node
        let this_node = this;
        var canvas = this_node.canvas;

        // Draw floating point
        if (canvas.floating_endpoint && canvas.floating_endpoint.from_node == this_node) {
            this.canvas.drawFloatingPath()
        }

        var pt1, pt2;

        for (var hook_id in this_node.hooks_by_id) {
            var hook = this_node.hooks_by_id[hook_id];
            pt1 = hook.get_center();

            hook.edges.forEach(edge => {       // hook.links is array with hook_ref as keys

                pt2 = edge.other_hook.get_center();

                if (hook.io === 'in') {
                    // hook is of type 'in': find path via other hook
                    let other_hook = edge.other_hook;
                    let edge_from_other_hook = other_hook.edges.find(edge => edge.other_hook == hook);
                    canvas.remove_path(edge_from_other_hook.path);
                    edge_from_other_hook.path = canvas.add_path(pt2, pt1, edge);
                } else {
                    // hook is of type 'out': it holds the path
                    if (edge.path) {
                        canvas.remove_path(edge.path);
                    }
                    // link.path = this_node.draw_path(pt1, pt2, hook.links_options);
                    edge.path = canvas.add_path(pt1, pt2, edge);
                }
            })
        }
    },

    mouse_down: function (option) {
        console.log('node_mouse_down' + option.target.caption);
        let canvas = this.canvas;
        let target = option.target;

        if (option.subTargets && option.subTargets.length > 0) {
            // user has clicked on one object from Node 's objects
            let inner_target = option.subTargets[0];
            if (inner_target.type === 'hook-bullet') {
                // this object was indeed a hook bullet

                let hook_bullet = inner_target;
                let hook = hook_bullet.hook;

                if (option.e && option.e.ctrlKey === true) {
                    // Ctrl-Click on bullet:  Delete all links
                    console.log('CONTROL CLICK ON BULLET');
                    // Ctrl-Click on bullet means remove all links
                    for (var hook_ref in hook.links) {       // hook.links is array with hook_ref as keys
                        let link = hook.links[hook_ref];
                        let other_hook = link.other_hook;
                        if (link.path) {
                            // link is outbound: it holds the path
                            canvas.remove(link.path);
                        } else {
                            // link must be inbound: the other end of the link holds the path
                            canvas.remove(other_hook.links[hook.get_ref()].path);
                        }
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

                        });

                        this.canvas.add(end_point);
                        this.canvas.floating_endpoint = end_point;
                        this.canvas.drawEdges();

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

////////////////////////////////////////////////////////////////////////////////////////
// Hook
////////////////////////////////////////////////////////////////////////////////////////
class Hook {
    constructor(id, node, caption = '', type = 'default', io = 'out',
                links_options = {}, expects = null, provides = null) {
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
        this.edges = [];
        this.links = {};
        this.links_options = links_options;
        this.provides = provides;
        this.expects = expects;
        this.graph = node.graph
    }

    neighborhood(point, radius = 10) {
        let center = this.get_center();

        return (Math.abs(center.x - point.x) < radius
            && Math.abs(center.y - point.y) < radius);
    }

    allow_connection(hook) {

        if (this.io === 'in') {
            return true
        }

        // at this point, we know we're dealing with output connections

        // check if node can be connected
        if (!this.node.allowConnection(this.node, hook.node)) {
            console.log('CYCLIC CONNECTION FORBIDDEN !  ');
            return false
        }

        // if expects is null, it accepts all types
        if (!hook.expects) {
            return true
        }
        // finally, check whether `hook` expects type  than what this hook provides
        return hook.expects.includes(this.provides);

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
        } else { // this.orientation === 'vertical'
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
        this.removeEdges();
        this.node.remove(this.text);
        this.node.remove(this.bullet);
    }

    get_ref() {
        return [this.node.id, this.id];
    }

    addEdge(other_hook) {

        // var other_hook_ref = other_hook.get_ref();

        const edge_already_exists = this.edges.some(edge => edge.other_hook == other_hook);

        if (edge_already_exists) {
            console.log("Warning: link already exists to target " + other_hook.get_ref());
            this.removeEdge(other_hook); // todo: update instead?
        }

        // if (other_hook_ref in this.links) {
        //     console.log("Warning: link already exists to target " + other_hook_ref);
        //     this.remove_link(other_hook);
        // }

        // this.links[other_hook_ref] = {
        //     this_hook: this,
        //     other_hook: other_hook,
        //     path: null
        // };

        this.edges.push({
            this_hook: this,
            other_hook: other_hook,
            path: null
        })
    }

    removeEdge(other_hook) {

        let edge = this.edges.filter(function (edge) {
            return edge.other_hook == other_hook;
        });

        if (edge.path) {
            this.node.canvas.remove(edge.path);
        }
        this.edges.remove(edge)
        // var other_hook_ref = other_hook.get_ref();
        // if (other_hook_ref in this.links) {
        //     var link = this.links[other_hook_ref];
        //     if (link.path) {
        //         this.node.canvas.remove(link.path);
        //     }
        //     delete this.links[other_hook_ref];
        //
        // }
        // todo: remove from ancestors/descendents
    }

    removeEdges() {
        // let io = this.io;
        this.edges.forEach(edge => {
            edge.other_hook.removeEdge()
        })
        // for (const [key, link] of Object.entries(this.links)) {
        //     if (this.io === 'in') {
        //         // Remove its output links by removing their reference in the next
        //         link.other_hook.remove_link(this)
        //     } else {
        //         // Remove its input links by removing their reference in the previous
        //         link.other_hook.remove_link(this)
        //     }
        // }

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

////////////////////////////////////////////////////////////////////////////////////////
// GraphPath
////////////////////////////////////////////////////////////////////////////////////////
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
