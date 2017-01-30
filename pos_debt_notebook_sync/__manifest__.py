# -*- coding: utf-8 -*-
{
    "name": """Sync Debt notebook for POS""",
    "summary": """Sync Debt notebook for POS""",
    "category": "Point of Sale",
    "images": [],
    "version": "1.0.0",

    "author": "IT-Projects LLC, Dinar Gabbasov",
    "website": "https://twitter.com/gabbasov_dinar",
    "license": "LGPL-3",
    # "price": 0.00,
    # "currency": "EUR",

    "depends": [
        "pos_longpolling",
        "pos_debt_notebook",
    ],
    "external_dependencies": {"python": [], "bin": []},
    "data": [
        'views/template.xml',
    ],
    'qweb': [],
    "demo": [],
    "installable": True,
    "auto_install": False,
}
