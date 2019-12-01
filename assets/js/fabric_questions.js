

fabric.QuestionNode = fabric.util.createClass(fabric.Node, {
    node_type: 'QuestionNode',
    initialize: function (canvas, question, options) {
        /**
         * @param question_obj
         * @param
         * @param
         * @param options
         */

        let default_options = {
        };

        this.canvas = canvas;
        this.options = Object.assign(default_options, options);
        this.question = question;


        let node_options = {
            width: 150,
            height: 200,
            overlay_padding: 20,
            hooks: [{
                "id": "in",
                "caption": "in",
                "type": "default",
                "io": "in"
            }],
        };


        var overlay = '<p>' + question.question_text + '</p>';

        for (let a=0; a < question.answers.length; a++) {
            var answer = question.answers[a];
            var letter = String.fromCharCode(65 + a) ;
            overlay += '<p><b>' + letter + '</b> ' + answer.answer_text + '</p>';
            node_options.hooks.push({
                "id": letter,
                "caption": letter,
                "type": answer.correct ? "answer_true" : "answer_false",
                "io": "out",
            });
            node_options.html_overlay = overlay;
        }


        // calls the parent's constructor
        this.callSuper('initialize', this.canvas, node_options);

        this.question_obj = new fabric.Text(question.question_text,
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


        // var question_dom_elt = document.createElement('div');
        // question_dom_elt.classList.add('question-elt');
        // question_dom_elt.innerHTML = question_obj.question_html;
        // question_dom_elt.id = 'question-elt-' + question_obj.id;
        // this.question_dom_elt = question_dom_elt;
        //
        // document.body.appendChild(question_dom_elt);


        this.add(this.question_obj);
        // this.question.set('top', this.body.height * 0.5);

        var this_question_node = this;

        // this.on('moved', function(options) {
        //    console.log('Question moved ' + this_question_node.id);
        //     this.position_htlm();
        //
        // });
        // this.on('moving', function(options) {
        //    console.log('Question moving ' + this_question_node.id);
        //     this.position_htlm();
        //
        // });
        // this.position_html();

    },

    to_object: function () {
        var object = this.callSuper('to_object');
        object.question = this.question;
        return object;
    },




});
