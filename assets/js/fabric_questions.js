

fabric.QuestionNode = fabric.util.createClass(fabric.Node, {
    type: 'QuestionNode',
    initialize: function (question_obj, options) {
        /**
         * @param question_obj
         * @param
         * @param
         * @param options
         */

        let default_options = {
        };
        this.options = Object.assign(default_options, options);


        let node_options = {
            width: 150,
            height: 200,
            hooks: [
                {
                    id: 'in',
                    caption: 'in',
                    io: 'in'

            }],
        };

        // calls the parent's constructor
        this.callSuper('initialize', node_options);

        this.question = new fabric.Text(question_obj.question_text,
            {
                originX: 'center',
                originY: 'center',
                fontFamily: 'Arial',
                fontSize: 11,
                fontStyle: 'bold',
                top: this.body.top + this.body.height * 0.5,
                left: this.body.left + this.body.width / 2,
                width: this.body.width - 10,
                fill: 'grey',
                stroke: null
        });

        this.add(this.question);
        // this.question.set('top', this.body.height * 0.5);

    }



});
