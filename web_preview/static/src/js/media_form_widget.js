odoo.define('media_form_widget', function(require) {
    var utils = require('web.utils');
    var core = require('web.core');
    var form_widgets = require('web.form_widgets');
    var KanbanRecord = require('web_kanban.Record');
    var session = require('web.session');
    var QWeb = core.qweb;
    var FieldBinaryImage = core.form_widget_registry.get('image');
    var _t = core._t;
    var common = require('web.form_common');
    var Model = require('web.DataModel');
    var attachment_url = require('ir_attachment_url');

    FieldBinaryImage.include({
        initialize_content: function() {
            this.media_type = this.view.datarecord.media_type;
            this.media_video_ID = this.view.datarecord.media_video_ID;
            this.media_video_service = this.view.datarecord.media_video_service;
            this.media = this.node.attrs.media;
            this._super();
        },
        render_value: function() {
            this.media_id = this.view.datarecord.id;
            if (this.media && (this.media_type == 'video/url' ||
                this.media_type == 'application/pdf' ||
                this.media_type == 'application/octet-stream')) {
                var url = "/web/static/src/img/mimetypes/document.png";
                if (this.media_type == 'video/url') {
                    var url = "/web/static/src/img/mimetypes/video.png";
                    if (this.media_video_service == 'youtube') {
                        url = "/web_preview/static/src/img/youtube.png";
                    } else if (this.media_video_service == 'vimeo') {
                        url = "/web_preview/static/src/img/vimeo.png";
                    }
                } else if (this.media_type == 'application/pdf') {
                    var url = "/web_preview/static/src/img/pdf.png";
                    this.pdf_url = session.url('/web/pdf', {
                        model: this.view.dataset.model,
                        id: JSON.stringify(this.view.datarecord.id),
                        field: this.name,
                        filename: this.view.datarecord.display_name,
                        unique: (this.view.datarecord.__last_update || '').replace(/[^0-9]/g, ''),
                    });
                } else {
                    this.do_warn(_t("Document"), _t("Could not display the selected document."));
                }
                var $media = $(QWeb.render("FieldBinaryImage-img", {widget: this, url: url}));
                this.$('> img').remove();
                this.$('> a img').remove();
                this.$el.prepend($media);
            } else {
                if (this.media_type && this.media_type.split("/")[0] == "image") {
                    this.media_type = 'image';
                }
                this._super();
            }
        },
        on_file_uploaded_and_valid: function(size, name, content_type, file_base64) {
            this.media_type = content_type;
            this._super(size, name, content_type, file_base64);
        },
    });

    // KanbanRecord.include({
    //     kanban_image: function(model, field, id, cache, options) {
    //         console.log("this",this);
    //         var model = new Model(model);
    //         model.call('name_search', [this.id]).then(function(res) {
    //             console.log("qwerty nigga",res)
    //         })
    //         return this._super(model, field, id, cache, options);
    //
    //     },
    // });
});
