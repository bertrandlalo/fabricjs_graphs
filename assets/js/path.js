
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

        const default_options = {
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
        let v = 0, d = 0, min_d, max_d, xd, yd, svg_path;

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
