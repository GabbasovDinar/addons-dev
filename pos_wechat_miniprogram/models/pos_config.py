# Copyright 2018 Dinar Gabbasov <https://it-projects.info/team/GabbasovDinar>
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl.html).
from odoo import models, fields, api

MODULE = 'pos_wechat_miniprogram'


class PosConfig(models.Model):
    _inherit = 'pos.config'

    allow_message_from_miniprogram = fields.Boolean('Allow receiving messages from the mini-program', default=True)

    @api.multi
    def open_session_cb(self):
        res = super(PosConfig, self).open_session_cb()
        self.init_pos_wechat_miniprogram_journal()
        return res

    def init_pos_wechat_miniprogram_journal(self):
        """Init demo Journals for current company"""
        # Multi-company is not primary task for this module, but I copied this
        # code from pos_debt_notebook, so why not
        journal_obj = self.env['account.journal']
        user = self.env.user
        wechat_journal_active = journal_obj.search([
            ('company_id', '=', user.company_id.id),
            ('wechat', '!=', False),
        ])
        if wechat_journal_active:
            return

        demo_is_on = self.env['ir.module.module'].search([('name', '=', MODULE)]).demo

        options = {
            'noupdate': True,
            'type': 'cash',
            'write_statement': demo_is_on,
        }
        wechat_miniprogram_jsapi_journal = self._create_wechat_mp_journal(dict(
            sequence_name='Wechat mini-program JSAPI Payment',
            prefix='WMPJSAPI-- ',
            journal_name='Wechat mini-program JSAPI Payment',
            code='WMPJSAPI',
            wechat='jsapi',
            **options
        ))
        if demo_is_on:
            self.write({
                'journal_ids': [
                    (4, wechat_miniprogram_jsapi_journal.id),
                ],
            })

    def _create_wechat_mp_journal(self, vals):
        user = self.env.user
        new_sequence = self.env['ir.sequence'].create({
            'name': vals['sequence_name'] + str(user.company_id.id),
            'padding': 3,
            'prefix': vals['prefix'] + str(user.company_id.id),
        })
        self.env['ir.model.data'].create({
            'name': 'journal_sequence' + str(new_sequence.id),
            'model': 'ir.sequence',
            'module': MODULE,
            'res_id': new_sequence.id,
            'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
        })
        journal = self.env['account.journal'].create({
            'name': vals['journal_name'],
            'code': vals['code'],
            'type': vals['type'],
            'wechat': vals['wechat'],
            'journal_user': True,
            'sequence_id': new_sequence.id,
        })
        self.env['ir.model.data'].create({
            'name': 'wechat_journal_' + str(journal.id),
            'model': 'account.journal',
            'module': MODULE,
            'res_id': int(journal.id),
            'noupdate': True,  # If it's False, target record (res_id) will be removed while module update
        })
        if vals['write_statement']:
            self.write({
                'journal_ids': [(4, journal.id)],
            })
            current_session = self.current_session_id
            statement = [(0, 0, {
                'name': current_session.name,
                'journal_id': journal.id,
                'user_id': user.id,
                'company_id': user.company_id.id
            })]
            current_session.write({
                'statement_ids': statement,
            })
        return journal
