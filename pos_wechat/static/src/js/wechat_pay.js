odoo.define('pos_payment_wechat', function(require){
    "use strict";

    var rpc = require('web.rpc');
    var core = require('web.core');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    var session = require('web.session');

    var _t = core._t;

    models.load_fields('account.journal', ['wechat']);

    gui.Gui.prototype.screen_classes.filter(function(el) { return el.name == 'payment'})[0].widget.include({
        init: function(parent, options) {
            this._super(parent, options);
            this.pos.bind('validate_order',function(){
                 this.validate_order();
            },this);
        }
    });



    var PosModelSuper = models.PosModel;
    models.PosModel = models.PosModel.extend({
        initialize: function(){
            var self = this;
            PosModelSuper.prototype.initialize.apply(this, arguments);
            this.wechat = new Wechat(this);

            this.bus.add_channel_callback(
                "micropay",
                this.on_micropay,
                this);
            this.ready.then(function(){
                // take out wechat cashregister from cashregisters to avoid
                // rendering in payment screent
                var wechat_journal = _.filter(self.journals, function(r){
                    return r.wechat;
                });
                if (wechat_journal.length){
                    if (wechat_journal.length > 1){
                        // TODO warning
                        console.log('error', 'More than one wechat journals found');
                    }
                    wechat_journal = wechat_journal[0];
                } else {
                    return;
                }
                self.wechat_cashregister = _.filter(self.cashregisters, function(r){
                    return r.journal_id[0] == wechat_journal.id;
                })[0];
                self.cashregisters = _.filter(self.cashregisters, function(r){
                    return r.journal_id[0] != wechat_journal.id;
                });
            });

        },
        on_micropay: function(msg){
            var order = this.get('orders').find(function(item){
                return item.uid === msg.order_ref;
            });
            if (order){
                if (parseInt(100*order.get_total_with_tax()) == msg['total_fee']){
                    // order is paid and has to be closed

                    // add payment
                    var newPaymentline = new models.Paymentline({},{
                        order: order,
                        micropay_id: msg['micropay_id'],
                        cashregister: this.wechat_cashregister,
                        pos: this});
                    newPaymentline.set_amount( msg['total_fee'] / 100.0 );
                    order.paymentlines.add(newPaymentline);

                    // validate order
                    this.trigger('validate_order');
                } else {
                    // order was changed before payment result is recieved
                    // TODO
                }
            } else {
                consoler.log('error', 'Order is not found');
            }
        },
    });


    var OrderSuper = models.Order;
    models.Order = models.Order.extend({
    });

    var PaymentlineSuper = models.Paymentline;
    models.Paymentline = models.Paymentline.extend({
        initialize: function(attributes, options){
            PaymentlineSuper.prototype.initialize.apply(this, arguments);
            this.micropay_id = options.micropay_id;
        },
        // TODO: do we need to extend init_from_JSON too ?
        export_as_JSON: function(){
            var res = PaymentlineSuper.prototype.export_as_JSON.apply(this, arguments);
            res['micropay_id'] = this.micropay_id;
            return res;
        },
    });

    var Wechat = Backbone.Model.extend({
        initialize: function(pos){
            var self = this;
            this.pos = pos;
            core.bus.on('qr_scanned', this, function(value){
                if (self.check_auth_code(value)){
                    self.process_qr(value);
                }
            });
        },
        check_auth_code: function(code) {
            return true; // for DEBUG
            if (code && Number.isInteger(+code) &&
                code.length === 18 &&
                +code[0] === 1 && (+code[1] >= 0 && +code[1] <= 5)) {
                return true;
            }
            return false;
        },
        process_qr: function(auth_code){
            var order = this.pos.get_order();
            if (!order){
                return;
            }
            // TODO: block order for editing
            this.micropay(auth_code, order);
        },
        micropay: function(auth_code, order){
            /* send request asynchronously */
            var self = this;

            // total_fee is amount of cents
            var total_fee = parseInt(100 * order.get_total_with_tax());

            var terminal_ref = 'POS/' + self.pos.config.name;
            var pos_id = self.pos.config.id;

            var send_it = function () {
                return rpc.query({
                    model: 'wechat.micropay',
                    method: 'pos_create_from_qr',
                    kwargs: {
                        'auth_code': auth_code,
                        'total_fee': total_fee,
                        'order_ref': order.uid,
                        'terminal_ref': terminal_ref,
                        'pos_id': pos_id,
                    },
                })
            };

            var current_send_number = 0;
            return send_it().fail(function (error, e) {
                if (self.pos.debug){
                    console.log('Wechat', self.pos.config.name, 'failed request #'+current_send_number+':', error.message);
                }
                self.show_warning();
            });
        },
        warning: function(warning_message){
            console.info('warning', warning_message);
            this.pos.chrome.gui.show_popup('error',{
                'title': _t('Warning'),
                'body': warning_message,
            });
        },
        show_warning: function(){
            var warning_message = _t("Some problems have happened. TEST");
            this.warning(warning_message);
        }
    });
});
