# -*- coding: utf-8 -*-
from odoo import http
import logging
import time
import traceback


_logger = logging.getLogger(__name__)


try:
    from odoo.addons.hw_escpos.escpos import *
    from odoo.addons.hw_escpos.controllers.main import EscposProxy
    from odoo.addons.hw_escpos.controllers.main import EscposDriver
    from odoo.addons.hw_escpos.escpos.exceptions import NoDeviceError, HandleDeviceError, TicketNotPrinted, NoStatusError
    from odoo.addons.hw_escpos.escpos.printer import Network
    import odoo.addons.hw_escpos.controllers.main as hw_escpos_main
except ImportError:
    EscposProxy = object


class UpdatedEscposDriver(EscposDriver):
    def run(self):
        printer = None
        if not escpos:
            _logger.error('ESC/POS cannot initialize, please verify system dependencies.')
            return
        while True:
            try:
                error = True
                timestamp, task, data = self.queue.get(True)
                printer = None
                if len(task) == 2:
                    if task[0] == 'network_xml_receipt':
                        if timestamp >= time.time() - 1 * 60 * 60:
                            network_printer_proxy = task[1]
                            # print in network printer
                            printer = UpdatedNetwork(network_printer_proxy)
                            printer.receipt(data)
                else:
                    printer = self.get_escpos_printer()
                if printer is None:
                    if task != 'status':
                        self.queue.put((timestamp, task, data))
                    error = False
                    time.sleep(5)
                    continue
                elif task == 'receipt':
                    if timestamp >= time.time() - 1 * 60 * 60:
                        self.print_receipt_body(printer, data)
                        printer.cut()
                elif task == 'xml_receipt':
                    if timestamp >= time.time() - 1 * 60 * 60:
                        printer.receipt(data)
                elif task == 'cashbox':
                    if timestamp >= time.time() - 12:
                        self.open_cashbox(printer)
                elif task == 'printstatus':
                    self.print_status(printer)
                elif task == 'status':
                    pass
                error = False

            except NoDeviceError as e:
                print "No device found %s" %str(e)
            except HandleDeviceError as e:
                print "Impossible to handle the device due to previous error %s" % str(e)
            except TicketNotPrinted as e:
                print "The ticket does not seems to have been fully printed %s" % str(e)
            except NoStatusError as e:
                print "Impossible to get the status of the printer %s" % str(e)
            except Exception as e:
                self.set_status('error', str(e))
                errmsg = str(e) + '\n' + '-'*60+'\n' + traceback.format_exc() + '-'*60 + '\n'
                _logger.error(errmsg)
            finally:
                if error:
                    self.queue.put((timestamp, task, data))
                if printer:
                    printer.close()


driver = UpdatedEscposDriver()
hw_escpos_main.driver = driver

driver.push_task('printstatus')


class UpdatedEscposProxy(EscposProxy):
    @http.route('/hw_proxy/print_xml_receipt', type='json', auth='none', cors='*')
    def print_xml_receipt(self, receipt, proxy=None):
        if proxy:
            _logger.info('ESC/POS: PRINT XML RECEIPT')
            driver.push_task(['network_xml_receipt', proxy], receipt)
        else:
            super(UpdatedEscposProxy, self).print_xml_receipt(receipt)


class UpdatedNetwork(Network):
    def close(self):
        """ Close TCP connection """
        if self.device:
            self.device.close()
