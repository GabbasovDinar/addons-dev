# -*- coding: utf-8 -*-
import logging
from odoo import api, models, fields

_logger = logging.getLogger(__name__)


class PosConfig(models.Model):
    _inherit = 'restaurant.printer'

    network_printer = fields.Boolean(default=False, string='Network Printer', help="Check this box if this printer is Network printer")


class PosConfig(models.Model):
    _inherit = 'pos.config'

    receipt_network_printer_ip = fields.Char(default=False, string="Receipt Printer IP", help="The ip address of the network printer for receipt, unused if left empty")
