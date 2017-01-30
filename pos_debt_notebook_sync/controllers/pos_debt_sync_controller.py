import openerp
from odoo.http import request


try:
    from odoo.addons.bus.controllers.main import BusController
except ImportError:
    BusController = object


class Controller(BusController):
    def _poll(self, dbname, channels, last, options):
        if request.session.uid:
            channels.append((request.db, 'pos.order_test', request.uid))
        return super(Controller, self)._poll(dbname, channels, last, options)

    @openerp.http.route('/pos_order_test/update', type="json", auth="public")
    def order_test_update(self, message):
        channel_name = "pos.order_test"
        res = request.env["pos.config"]._send_to_channel(channel_name, message)
        return res
