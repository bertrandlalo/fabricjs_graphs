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
        this.node = node;
        this.caption = caption;
        this.type = type;
        this.io = io;
        this.id = id || this.generateID(io); //TODO check if unique

        this.edges = [];
        this.links = {};
        this.links_options = links_options;
        this.provides = provides;
        this.expects = expects;
        this.graph = node.graph
    }

    generateID(io) {
        return io + '_' + (this.node.hooks[io].length + 1);
    }

    neighborhood(point, radius = 10) {
        let center = this.getCenter();

        return (Math.abs(center.x - point.x) < radius
            && Math.abs(center.y - point.y) < radius);
    }

    allowConnection(hook) {

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

    createBullet(options) {
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

    removeFromCanvas() {
        this.removeEdges();
        this.node.remove(this.text);
        this.node.remove(this.bullet);
    }

    getRef() {
        return [this.node.id, this.id];
    }

    addEdge(other_hook) {


        const edge_already_exists = this.edges.some(edge => edge.other_hook === other_hook);

        if (edge_already_exists) {
            console.log("Warning: link already exists to target " + other_hook.getRef());
            this.removeEdge(other_hook); // todo: update instead?
        }
        this.edges.push(new Edge(
            {
                this_hook: this,
                other_hook: other_hook,
                path: null
            })
        )
    }

    removeEdge(other_hook) {

        let edge = this.edges.filter(function (edge) {
            return edge.other_hook === other_hook;
        });

        if (edge.path) {
            this.node.canvas.remove(edge.path);
        }
        this.edges.remove(edge)
        // todo: remove from ancestors/descendents
    }

    removeEdges() {
        // let io = this.io;
        this.edges.forEach(edge => {
            edge.other_hook.removeEdge()
        })
    }

    getCenter() {
        let node = this.node;
        let center = node.getHookCenter(this);
        return center;
    }

    toObject(includeCanvasProperties) {
        if (includeCanvasProperties) {
            return {
                id: this.id,
                caption: this.caption,
                type: this.type,
                io: this.io,
                provides: this.provides,
                links_options: this.links_options,
                bullet_options: this.options
            };
        } else {
            return {
                id: this.id,
                caption: this.caption,
                type: this.type,
                io: this.io,
            };
        }


    }
}


////////////////////////////////////////////////////////////////////////////////////////
// Edge
////////////////////////////////////////////////////////////////////////////////////////
class Edge {
    constructor(options) {
        this.this_hook = options.this_hook;
        this.other_hook = options.other_hook;
        this.path = options.path;
    }
    getRef() {
        return {
            source: this_hook.node.id + ':' + this_hook.id,
            target: other_hook.node.id + ':' + other_hook.id
        }
    }

    static fromRef(graph, ref) {
        let this_ref = ref.source;
        let other_ref = ref.target;

        let this_node_id = this_ref.split(':')[0];
        let this_hook_id = this_ref.split(':')[1];
        let other_node_id = other_ref.split(':')[0];
        let other_hook_id = other_ref.split(':')[1];
        let this_node = graph.getNode(this_node_id);
        let other_node = graph.getNode(other_node_id);
        return new Edge({
            this_hook: this_node.getHook(this_hook_id),
            other_hook: other_node.getHook(other_hook_id),
        });
    }
}
