odoo.define('pos_cancel_order.cancel_order', function (require) {
    "use strict";

    // var PopupWidget = require('point_of_sale.popups');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    // var Model = require('web.Model');
    // var Widget = require('web.Widget');
    var core = require('web.core');
    // var PosDiscountWidget = require('pos_discount.pos_discount');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var QWeb = core.qweb;
    var _t = core._t;

    PosBaseWidget.include({
        init:function(parent,options){
            var self = this;
            this._super(parent,options);
            if (this.gui && this.gui.screen_instances.products && this.gui.screen_instances.products.action_buttons.submit_order) {
                this.gui.screen_instances.products.action_buttons.submit_order.button_click = function() {
                    var order = this.pos.get_order();
                    if(order.hasChangesToPrint()){
                        order.сancel_button_available = true;
                        order.printChanges();
                        order.saveChanges();
                    }
                }
            }
        }
    });

    var OrderCancelButton = screens.ActionButtonWidget.extend({
        template: 'OrderCancelButton',
        button_click: function(){
            var self = this;
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            lines = lines.filter(function(line){
                return line.mp_dirty === false;
            });
            if (!lines.length > 0) {
                order.сancel_button_available = false;
            }
            if (order.сancel_button_available) {
                this.gui.show_screen('cancelproductlist');
            } else {
                return false;
            }
        },
    });

    screens.define_action_button({
        'name': 'order_cancel',
        'widget': OrderCancelButton,
        // 'condition': true,
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        printCanceledProducts: function(lines){
            var self = this;
            lines.forEach(function(line){
                self.remove_orderline(line);
            });
            this.printChanges();
            this.saveChanges();
        },
        computeChanges: function(categories){
            console.log("66");
            var self = this;
            /* тут функция нужна для того чтобы только отмененные заказы отправлять на печать
            а линии которые ранее не были отправлены на печать не трогать
            НЕОБХОДИМО ПРОВЕРИТЬ НА РАБОТОСПОСОБНОСТЬ ДАННОЙ ФУНКЦИИ
            */
            // var res = _super_order.computeChanges.apply(this, arguments);
            // if (this.opened_cancel_widget_screen) {
            //     res.new = [];
            // }
            // console.log("computeChanges");
            // return res
        },
        export_as_JSON: function(){
            var json = _super_order.export_as_JSON.apply(this,arguments);
            json.сancel_button_available = this.сancel_button_available;
            return json;
        },
        init_from_JSON: function(json){
            _super_order.init_from_JSON.apply(this,arguments);
            this.сancel_button_available = json.сancel_button_available;
        },
        get_printed_order_lines: function() {
            var lines = this.get_orderlines();
            lines = lines.filter(function(line){
                return line.mp_dirty === false;
            });
            var printers = this.pos.printers;
            var categories_ids = [];
            for(var i = 0; i < printers.length; i++) {
                var product_categories_ids = (printers[i].config.product_categories_ids);
                product_categories_ids.forEach(function(id){
                    categories_ids.push(id);
                });
            }
            var unique_categories_ids = [];
            this.unique(categories_ids).forEach(function(id){
                unique_categories_ids.push(Number(id));
            });
            var new_lines = [];
            unique_categories_ids.forEach(function(id){
                lines.forEach(function(line){
                    if (line.product.pos_categ_id[0] === id) {
                        new_lines.push(line)
                    }
                });
            });
            if (!new_lines.length > 0) {
                this.сancel_button_available = false;
            } else {
                this.сancel_button_available = true;
            }
            return new_lines;
        },
        unique: function(arr){
            var obj = {};
            for (var i = 0; i < arr.length; i++) {
                var str = arr[i];
                obj[str] = true;
            }
            return Object.keys(obj);
        },

    });

    var OrderCancelScreenWidget = screens.ScreenWidget.extend({
        template: 'OrderCancelScreenWidget',
        init: function(parent, options){
            this._super(parent, options);
            this.order_cancel_cache = new screens.DomCache();
        },
        auto_back: true,
        show: function(){
            var self = this;
            this._super();
            this.selected_lines_id = [];
            this.details_visible = false;


            this.renderElement();

            var order = this.pos.get_order();
            order.opened_cancel_widget_screen = true;

            this.$('.back').click(function(){
                order.opened_cancel_widget_screen = false;
                self.gui.back();
            });

            this.$('.next').click(function(){
                self.save_changes();
                order.opened_cancel_widget_screen = false;
                self.gui.back();
            });

            var lines = this.pos.get_order().get_printed_order_lines();

            this.render_list(lines);

            this.$('.order-product-list-contents').delegate('.product-line','click',function(event){
                self.line_select(event,$(this),parseInt($(this).data('id')));
            });
            this.$('.order-product-list').delegate('th','click',function(event){
                var product_lines = self.$('.order-product-list-contents .product-line');
                product_lines.each(function(){
                    self.line_select(event,$(this),parseInt($(this).data('id')));
                });
            });
        },
        hide: function () {
            this._super();
        },
        render_list: function(lines){
            var contents = this.$el[0].querySelector('.order-product-list-contents');
            contents.innerHTML = "";
            for(var i = 0, len = Math.min(lines.length,1000); i < len; i++){
                var line    = lines[i];
                var productline = this.order_cancel_cache.get_node(line.id);
                if(!productline){
                    var productline_html = QWeb.render('ProductLine',{widget: this, line:lines[i]});
                    productline = document.createElement('tbody');
                    productline.innerHTML = productline_html;
                    productline = productline.childNodes[1];
                    this.order_cancel_cache.cache_node(line.id,productline);
                }
                productline.classList.remove('highlight');
                contents.appendChild(productline);
            }
        },
        save_changes: function(){
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            var cancelled_lines = [];
            this.selected_lines_id.forEach(function(line_id){
                cancelled_lines.push(lines.find(function(line) {
                    return line.id == line_id;
                }));
            });
            order.printCanceledProducts(cancelled_lines);
        },
        toggle_save_button: function(){
            var $button = this.$('.button.next');
            var self = this;
            if (this.selected_lines_id.length !== 0) {
                $button.removeClass('oe_hidden');
                $button.text(_t('Apply'));
            } else {
                $button.addClass('oe_hidden');
                self.display_note('hide');
            }
        },
        line_select: function(event,$line,id){
            if ( $line.hasClass('highlight') ){
                $line.removeClass('highlight');
                var line_id = this.selected_lines_id.indexOf(id);
                if (line_id !== -1) {
                    this.selected_lines_id.splice(line_id, 1);
                }
            }else {
                this.$('.product-line .highlight').removeClass('highlight');
                $line.addClass('highlight');
                this.selected_lines_id.push(id);
                var y = event.pageY - $line.parent().offset().top;
                this.display_note('show',y);
            }
            this.toggle_save_button();
        },
        display_note: function(visibility, clickpos){
            console.log(visibility);
            var self = this;
            var contents = this.$('.cancellation-reason-contents');
            var parent   = this.$('.order-product-list').parent();
            var scroll   = parent.scrollTop();
            var height   = contents.height();
            if(visibility === 'show'){
                // contents.empty();
                // contents.append($(QWeb.render('ClientDetails',{widget:this,partner:partner})));

                var new_height   = contents.height();

                if(!this.details_visible){
                    if(clickpos < scroll + new_height + 20 ){
                        parent.scrollTop( clickpos - 20 );
                    }else{
                        parent.scrollTop(parent.scrollTop() + new_height);
                    }
                }else{
                    parent.scrollTop(parent.scrollTop() - height + new_height);
                }

                this.details_visible = true;
            } else if (visibility === 'hide') {
                contents.empty();
                if( height > scroll ){
                    contents.css({height:height+'px'});
                    contents.animate({height:0},400,function(){
                        contents.css({height:''});
                    });
                }else{
                    parent.scrollTop( parent.scrollTop() - height);
                }
                this.details_visible = false;
            }
        },
        close: function(){
            this._super();
        },
    });
    gui.define_screen({name:'cancelproductlist', widget: OrderCancelScreenWidget});

    screens.OrderWidget.include({
        update_summary: function(){
            this._super();
            var сancel_button_available = this.pos.get_order().сancel_button_available;
            var buttons = this.getParent().action_buttons;

            this.pos.get_order().get_printed_order_lines();

            if (buttons && buttons.order_cancel ) {
                buttons.order_cancel.highlight(сancel_button_available);
            }
        },
    });
});
