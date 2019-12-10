////////////////////////////////////////////////////////////////////////////////////////
// Graph
////////////////////////////////////////////////////////////////////////////////////////
class Graph {
    constructor(options) {
        /**
         * @param {Object} [options]
         * @param {string} [options.id] - hook id.
         * @param {fabric.Node} [options.node] - node that this hook belongs to
         * @param {string} [options.caption] - caption to print in front of the hook
         * @param {string} [options.io] - 'in' or 'out', defines if this hook is input or output of its node

         */

        this.lastNodeID = 0;
        this.id = options.id; //TODO check if unique
        this.isAcyclic = options.acyclic || true;
        this.nodes = [];
    }

    getNode(node_id) {
        node_id = Number(node_id) // todo: fix this !!!
        return this.nodes.find(node => node.id === node_id);
    }

    addNode(node) {
        this.nodes.push(node)
    };

    removeNode(node) {
        // this.nodes.remove(node)

        this.nodes = this.nodes.filter(el => el != node);
        //    todo: delete edges
    };

    numberOfNodes() {
        return this.nodes.length;
    }

    order() {
        return this.nodes.length;
    }

    generateNodeID() {
        this.lastNodeID += 1;
        return this.lastNodeID
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

    toCanvas(canvas) {
        this.canvas = canvas
    }

    toObject() {
        let graph_object = {
                'container_id': this.canvas.id,
                'graph_id': this.id,
                'nodes': this.nodes.map(node => node.toObject()),
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
 *   - toObject
 *   - make_unique_id
 *   - draw_all_links
 *   - clear_floating_endpoint
 *   - AddNode, removeNode
 *   - add_path, removePath
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
        console.log('I am a GraphCanvas!');
        super(container_id);
        this.lastGraphID = 0;
        this.id = container_id;

        // this.graph = new jsnx.MultiDiGraph(); // or DiGraph, MultiGraph, MultiDiGraph, etc
        // this.all_nodes = {};
        this.floating_endpoint = null;

        this.hook_types = options.hook_types;

        this.addGraph(options);
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
                let end_point = options.target;
                let node = end_point.from_node;
                node.drawEdges();
            }
        });

        this.on('mouse:down', function (options) {
            let evt = options.e;
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
                let e = options.e;
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
                let end_point = options.target;
                this._endpointMovedHandler(end_point);
            }
        });

        this.on('object:selected', function (options) {
            console.log('object:selected ' + options.target.type);
            if (options.target.type === 'path') {
                options.target.set('strokeWidth', 4);
            }
        });

        this.on('mouse:wheel', function (opt) {
            let delta = opt.e.deltaY;
            let zoom = this.getZoom();
            zoom = zoom + delta / 200;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            this.zoomToPoint({x: opt.e.offsetX, y: opt.e.offsetY}, zoom);
            opt.e.preventDefault();
            opt.e.stopPropagation();
            let vpt = this.viewportTransform;
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

    addGraph(options) {
        //todo: allow multiple graph in same canvas?
        if (options.graph_id) {
            options.id = options.graph_id
        } else {
            options.id = this.generateGraphID();
        }
        this.graph = new Graph(options);
        this.graph.toCanvas(this);
    }

    generateGraphID() {
        this.lastGraphID += 1;
        return this.lastGraphID
    }

    static fromObject(options) {
        if (options.container_id) {
            var graph_canvas = new GraphCanvas(options.container_id, options);
        } else if (options.graph_canvas) {
            var graph_canvas = options.canvas
        } else {
            throw 'Object should give a graphCanvas object or container_id'
        }
        options.nodes.forEach(node_options => {
            graph_canvas.newNode(node_options)
        });
        options.edges.forEach(edge_ref => {
            let edge = Edge.fromRef(graph_canvas.graph, edge_ref); // todo: disambiguish graph, can there be more than one?
            graph_canvas.newConnection(edge.this_hook, edge.other_hook)
        });
        graph_canvas.drawEdges();
        return graph_canvas
    }

    _keydownHandler(ev) {

        let obj = this.getActiveObject();

        if (!obj)
            return;

        let selected_node = typeof obj && obj.type === 'Node' ? obj : null;
        let selected_graph_path = typeof obj && obj.type === 'GraphPath' ? obj : null;

        console.log('handle_keydown ' + ev.key + ' on ' + (selected_node ? selected_node.name : 'none'));

        if (selected_node) {
            if (ev.key === 'd' && ev.ctrlKey) {
                // Duplicate Node
                ev.preventDefault();
                selected_node.clone();
            } else if (ev.key === "Delete") {
                // Delete Node
                ev.preventDefault();
                canvas.removeNode(selected_node);
            }
        }
        if (selected_graph_path) {
            // Selected object is a GraphPath
            if (ev.key === "Delete") {
                // Delete GraphPath
                ev.preventDefault();
                canvas.removePath(selected_graph_path);
                let link = selected_graph_path.link || null;
                if (link) {
                    // Remove link from source hook
                    let source_hook = link.this_hook;
                    let other_hook_ref = link.other_hook.getRef();
                    // Remove link from target hook
                    let target_hook = link.other_hook;
                    let this_hook_ref = link.this_hook.getRef();

                    delete source_hook.links[other_hook_ref];
                    delete target_hook.links[this_hook_ref];
                }
            }

        }
    }

    _endpointMovedHandler(end_point) {
        // check if connection is done
        let end_point_center = end_point.getCenterPoint();
        let neighbor_found = false;
        let target_found = false;

        this.graph.nodes.every(node => {
            // Loop over all nodes, looking for one that has a hook that is in
            // the endpoint's neighborhood

            node.hooks.in.every(hook => {
                // Loop over all input hooks of the current node
                let target_hook = hook;
                let tarGetHookCenter = node.getHookCenter(target_hook);
                console.log(tarGetHookCenter);

                // if (Math.abs(tarGetHookCenter.x - end_point_center.x) < 10
                //     && Math.abs(tarGetHookCenter.y - end_point_center.y) < 10) {
                if (target_hook.neighborhood(end_point_center)) {
                    console.log('END POINT IN' + node.caption + ' NEIGHBORHOOD');

                    neighbor_found = true;
                    let source_node = end_point.from_node;
                    let source_hook = end_point.from_hook;

                    if (source_hook.allowConnection(target_hook)) {

                        // Check if hook types are compatible

                        this.clearFloatingEndpoint();

                        // check that link  from  source_hook to target_hook does not exist already
                        // link_already_exists = (target_hook.get_ref() in source_hook.links);
                        let link_already_exists = source_hook.edges.some(edge => edge.other_hook === target_hook);


                        if (!link_already_exists) {
                            // Create a link from source_hook to target_hook
                            this.newConnection(source_hook, target_hook);
                            source_node.drawEdges();
                            return false; // this is equivalent to break if links already exists
                        } else return true
                    }
                }
                return !neighbor_found; // this is equivalent to break if neighbor found
            });
            return !target_found; // this is equivalent to break if  target found
        })
    }

    newConnection(hook1, hook2) {
        hook1.addEdge(hook2);
        hook2.addEdge(hook1);
    }

    getIndegrees() {
        //  indegree_map = {};
        let indegrees = [];
        Object.entries(this.graph.nodes).forEach(
            ([id, node]) => indegrees.push({id: id, degree: node.get_ancestors().length || 0})//indegree_map[id] = node.descendants.length || 0
        );
        console.log(indegrees);
        return indegrees
    };

    sortGraph() {
        let sorted_nodes = [];
        // let indegrees = this.get_indegrees();
        //     # These nodes have zero indegree and ready to be returned.
        let indegrees = this.getIndegrees().filter(indegree => indegree.degree > 0)
        let zero_indegrees = this.getIndegrees().filter(indegree => indegree.degree === 0).map(indegree => indegree.id);

        while (zero_indegrees.length > 0) {
            console.log(zero_indegrees)

            let node_id = zero_indegrees.pop();
            let node = this.graph.nodes[node_id];
            let descendants = node.getDescendants();
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

    getSelectedNode() {
        let obj = this.getActiveObject();
        return typeof obj !== 'undefined' && obj.type === 'Node' ? obj : null;
    };


    newNode(options) {
        // check if there is an id
        // options.id = options.id || this.make_unique_id();
        options.id = this.graph.generateNodeID();
        let node = new fabric.Node(options);
        // node._graphCanvas = this;
        node.toCanvas(this, options);
        return node;
    };

    addNode(node) {
        // todo instead, first check if there is an id
        this.graph.addNode(node);
        this.add(node);
    };

    removeNode(node) {
        // Rempve from all_nodes
        // delete this.all_nodes[node.id];
        // Remove from graph
        this.graph.removeNode(node);

        // Remove links
        node.getHooks().forEach(hook => hook.removeEdges());

        // Eventually, remove floating endpoint
        if (this.floating_endpoint && this.floating_endpoint.from_node == node) {
            this.clearFloatingEndpoint()
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
        pt1 = source_hook.getCenter();
        pt2 = floating_endpoint.getCenterPoint();
        // clean existing paths
        // this.clean_hook_paths(hook);
        // draw new path
        if (floating_endpoint.path) {
            this.remove(floating_endpoint.path);
        }
        console.log(source_hook.links_options);
        // floating_endpoint.path = this_node.draw_path(pt1, pt2, source_hook.links_options);
        floating_endpoint.path = this.addPath(pt1, pt2);
        floating_endpoint.bringToFront();
        // }
    };

    drawEdges() {
        console.log('drawEdges! ');
        this.graph.nodes.forEach(node => node.drawEdges());

        if (this.floating_endpoint) {
            this.floating_endpoint.bringToFront();
        }

    };

    clearFloatingEndpoint() {
        if (this.floating_endpoint) {
            this.remove(this.floating_endpoint);
            if (this.floating_endpoint.path) {
                this.remove(this.floating_endpoint.path);
            }
            this.floating_endpoint = null;
        }
    };

    addPath(pt1, pt2, link, options) {

        let graph_path = new fabric.GraphPath(pt1, pt2, link, options);
        this.add(graph_path);
        return graph_path;
    };

    removePath(graph_path) {
        this.remove(graph_path)
    };


}
