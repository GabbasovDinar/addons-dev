/* Copyright 2018 Dinar Gabbasov <https://it-projects.info/team/GabbasovDinar>
 * License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl.html). */
odoo.define('pos_orders_history_return.screens', function (require) {
    "use strict";

    var core = require('web.core');
    var screens = require('pos_orders_history.screens');
    var models = require('pos_orders_history.models');
    var QWeb = core.qweb;
    var _t = core._t;


    screens.OrdersHistoryScreenWidget.include({
        show: function () {
            var self = this;
            this._super();
            if (this.pos.config.return_orders) {
                this.$('.actions.oe_hidden').removeClass('oe_hidden');
                this.$('.button.return').unbind('click');
                this.$('.button.return').click(function (e) {
                    var parent = $(this).parents('.order-line');
                    var id = parseInt(parent.data('id'));
                    self.click_return_order_by_id(id);
                });
            }
        },
        render_list: function(orders) {
            if (!this.config.show_returned_orders) {
                orders = orders.filter(function(order) {
                    return order.returned_order !== true;
                });
            }
            this._super(orders);
        },
        click_return_order_by_id: function(id) {
            var self = this;
            var order = self.pos.db.orders_history_by_id[id];
            var uid = order.pos_reference.split(' ')[1];
            var split_sequence_number = uid.split('-');
            var sequence_number = split_sequence_number[split_sequence_number.length - 1];

            var orders = this.pos.get('orders').models;
            var exist_order = orders.find(function(o) {
                return o.uid === uid && Number(o.sequence_number) === Number(sequence_number);
            });

            if (exist_order) {
                this.pos.gui.show_popup('error',{
                    'title': _t('Warning'),
                    'body': _t('You have an unfinished return of the order. Please complete the return of the order and try again.'),
                });
                return false;
            }

            var lines = [];
            order.lines.forEach(function(line_id) {
                lines.push(self.pos.db.line_by_id[line_id]);
            });
            var products = [];
            lines.forEach(function(line) {
                var product = self.pos.db.get_product_by_id(line.product_id[0]);
                products.push(product);
            });
            if (products.length > 0) {
                // create new order for return
                var json = _.extend({}, order);
                json.uid = uid;
                json.sequence_number = Number(sequence_number);
                json.lines = [];
                json.statement_ids = [];
                json.mode = "return";
                json.return_lines = lines;

                var options = _.extend({pos: this.pos}, {json: json});
                order = new models.Order({}, options);

                this.pos.get('orders').add(order);
                this.pos.gui.back();
                this.pos.set_order(order);
                this.pos.chrome.screens.products.product_list_widget.set_product_list(products);
            } else {
                this.pos.gui.show_popup('error', _t('Order Is Empty'));
            }
        },
    });

    screens.ProductCategoriesWidget.include({
        renderElement: function() {
            this._super();
            var self = this;
            var order = this.pos.get_order();
            if (order.get_mode() === "return") {
                var returned_orders = this.pos.get_returned_orders_by_pos_reference(order.name);
                // add exist products
                var products = [];
                if (returned_orders && returned_orders.length) {
                    returned_orders.forEach(function(o) {
                        o.lines.forEach(function(line_id) {
                            var line = self.pos.db.line_by_id[line_id];
                            var product = self.pos.db.get_product_by_id(line.product_id[0]);
                            var exist_product = products.find(function(r){
                                return r.id === product.id;
                            });
                            if (exist_product) {
                                exist_product.max_return_qty += line.qty;
                            } else {
                                product.max_return_qty = line.qty;
                                products.push(product);
                            }
                        });
                    });
                }
                // update max qty for current return order
                order.return_lines.forEach(function(line) {
                    var product = self.pos.db.get_product_by_id(line.product_id[0]);
                    var exist_product = products.find(function(r){
                        return r.id === product.id;
                    });
                    if (exist_product) {
                        exist_product.max_return_qty += line.qty;
                    } else {
                        product.max_return_qty = line.qty;
                        products.push(product);
                    }
                });
                this.product_list_widget.set_product_list(products);
            }
        }
    });

    screens.ProductListWidget.include({
        render_product: function(product){
            var cached = this._super(product);
            var order = this.pos.get_order();
            var el = $(cached).find('.max-return-qty');
            if (el.length) {
                el.remove();
            }
            if (order.get_mode() === "return" && typeof product.max_return_qty !== 'undefined') {
                var current_return_qty = order.get_current_product_return_qty(product);
                var qty = product.max_return_qty - current_return_qty;
                $(cached).find('.product-img').append('<div class="max-return-qty">' + qty + '</div>');
            }
            return cached;
        },
    });

    return screens;
});
