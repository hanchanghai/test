import * as express from "express";
import {updateOrderBySFDC, getDealerList, getOrderDetailByPomsId, getOrderLoanInfoByPomsId, cancelOrder, updateVehicleBySFDC} from "./../service/OrderService";
import {queryBindingOrderPayment, processCallback, createPaymentWithPomsid, syncPaymentToPoms} from "../service/PaymentService";
import {handleServiceException} from "../utils/errorHandler";
import {extractTokenInfoWithoutVerify} from "../utils/jwt";
import {
    createOrderByConfig,
    updateOrderByConfig,
    getMyOrderList,
    getMyOrder,
    getMyOrderStatus,
    updateOrderByLoan,
    giveUpGracePeriod,
    getMyOrderByPomsid,
    getPagingOrderList
} from "../service/MyOrderService";
import {
    simulatePreOrderByOrderId,
    simulatePreOrderByConfigId,
    simulateGetOrder,
    simulateGetPayments,
    simulatePaymentRecord,
    simulateGetOrderByPomsid,
    simulateVinNotification,
    simulatePomsSns
} from "../service/SimulateService";
import {checkout, requestRefund, updateOrderDetail, updateOrderGroup} from "../service/CheckoutService";
import {estimateByCheckout, estimateDiscount, getDiscountByConfiguratorId, initOrderDiscount} from "../service/PromoService";
import {receivePomsSNS} from "../service/PomsSnsService";
import {getCompletedVehicle} from "../service/VehicleService";
import {oneTimeUpdate_ALL_v1_10_0} from "../service/OneTimeLiveOPService";
import {PromoConfig, PromoGroup} from "../model/Promo";
import {saveMaterial} from "../service/MaterialService";
import {processHandoverSns} from "../service/HandoverService";
import {Checkout} from "../model/Checkout";

const router = express.Router();

//===================== Order List ========================

router.get("/", (req, res) => {
    let pomsid: string = req.query.pomsid;

    let pageIndex: string = req.query.pageIndex;
    let itemsPerPage: string = req.query.itemsPerPage;

    if (pomsid) {
        extractTokenInfoWithoutVerify(req)
            .then(token => getMyOrderByPomsid(token, pomsid))
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    } else if (pageIndex && itemsPerPage) {
        extractTokenInfoWithoutVerify(req)
            .then(token => getPagingOrderList(token, pageIndex, itemsPerPage))
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    } else {
        extractTokenInfoWithoutVerify(req)
            .then(token => getMyOrderList(token))
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    }
});

//================== Discount ========================
router.post('/discount/estimate', async (req, res, next) => {
    let config: PromoConfig = req.body;

    return Promise.resolve(estimateDiscount(config))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

router.get("/discount", async (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getDiscountByConfiguratorId(req.query.configId)
               .then(rtn => res.status(200).jsonp(rtn)))
        .catch(e => {
            handleServiceException(e, res);
        })
})

router.post('/:orderId/discount/estimate', async (req, res, next) => {
    let checkout: Checkout = req.body;
    let orderId = req.params.orderId;
    return Promise.resolve(estimateByCheckout(orderId, checkout))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });

});

//================== Factory ================================
router.post('/s3/sns', async (req, res, next) => {
    saveMaterial(req)
        .then(_ => res.status(200).jsonp({}))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//================== APP SNS ===============================
router.post('/cua/sns/handover', async (req, res, next) => {
    processHandoverSns(req)
        .then(_ => res.status(200).jsonp({}))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//================== POMS ===================================

//  /api/orders/detail/?pomsid=
router.get("/detail", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getOrderDetailByPomsId(token, req.query.pomsid))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//  /api/orders/loan/?pomsid=
router.get("/loan", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getOrderLoanInfoByPomsId(token, req.query.pomsid))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//poms sns
router.post('/poms/sns', async (req, res, next) => {
    receivePomsSNS(req)
        .then(_ => res.status(200).jsonp({}))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//get by pomsid
router.get('/poms/:pomsid', async (req, res, next) => {
    let pomsid = req.params.pomsid;

    extractTokenInfoWithoutVerify(req)
        .then(token => getMyOrderByPomsid(token, pomsid))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//cancel order by pomsid
router.delete('/poms/:pomsid', async (req, res, next) => {
    let pomsid = req.params.pomsid;

    extractTokenInfoWithoutVerify(req)
        .then(token => cancelOrder(token, null, pomsid, "cua"))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//================== Vehicle ====================

router.get('/vehicle', async (req, res, next) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getCompletedVehicle(req.query.pscnid || token.id))
        .then(v => res.status(200).jsonp(v))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//
router.post('/vehicle', async (req, res, next) => {
    let pomsid: string = req.body.pomsid;
    let invoiceDate: Date = req.body.invoiceDate;
    let invoiceNo: string = req.body.invoiceNo;

    extractTokenInfoWithoutVerify(req)
        .then(token => updateVehicleBySFDC(token, pomsid, invoiceDate, invoiceNo))
        .then(_ => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//================== Payment =====================
//callback from payment-gateway
router.post('/payment/callback', async (req, res, next) => {
    let paymentRtn = req.body;
    processCallback(paymentRtn)
        .then(_ => res.status(200).jsonp({}))
        .catch(e => {
            handleServiceException(e, res);
        });
});

//web front usage (PUMP)
router.post('/payment', async (req, res, next) => {
    let pomsid: string = req.body.pomsid;
    let orderid: string = req.body.orderid;
    let gateway: string = req.body.gateway;

    extractTokenInfoWithoutVerify(req)
        .then(token => createPaymentWithPomsid(token, pomsid, orderid, gateway, req.body, "Pump", "cua"))
        .then(_ => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        });
});


//================== Order - Payment =====================

//create by config
router.post("/", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => createOrderByConfig(token, req.body))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        })
});

//update by sfdc
router.put("/", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => updateOrderBySFDC(token, req.body))
        .then(result => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        })
});

//get by orderid
router.get("/:orderid", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getMyOrder(req.params.orderid))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        })
});

router.get("/:orderid/status", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getMyOrderStatus(req.params.orderid))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        })
});

//Note: retried
router.get("/:orderid/dealers", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => getDealerList())
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        })
});

//update by config
router.patch("/:orderid/config", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => updateOrderByConfig(token, req.params.orderid, req.body))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        })
});

//update by loan
router.patch("/:orderid/loan", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => updateOrderByLoan(token, req.params.orderid, req.body))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        })
});

//update order detail
//internal usage only
router.patch("/:orderid/detail", (req, res) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => updateOrderDetail(token, req.params.orderid, req.body))
        .then(result => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        })
});

router.patch("/:orderid/discount", (req, res) => {
    let orderid: string = req.params.orderid;
    let triggerDate: Date = req.body.triggerDate;

    extractTokenInfoWithoutVerify(req)
        .then(token => initOrderDiscount(token, orderid, triggerDate))
        .then(result => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        })
});

router.patch("/:orderid/group", (req, res) => {
    let orderid: string = req.params.orderid;
    let group: PromoGroup = req.body;
    extractTokenInfoWithoutVerify(req)
        .then(token => updateOrderGroup(token, orderid, group))
        .then(result => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        })
})


// give up grace period
router.delete('/:orderid/gracePeriod', async (req, res, next) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => giveUpGracePeriod(token, req.params.orderid))
        .then(result => res.status(200).jsonp({success: true}))
        .catch(e => {
            handleServiceException(e, res);
        })
});

router.post('/:orderid/checkout', async (req, res, next) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => checkout(token, req.params.orderid, req.body))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

router.post('/:orderid/refund', async (req, res, next) => {
    extractTokenInfoWithoutVerify(req)
        .then(token => requestRefund(token, req.params.orderid, req.body, "cua"))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

router.get('/:orderid/checkout/:uid', async (req, res, next) => {
    let orderid = req.params.orderid;
    let uid = req.params.uid;
    if (!orderid || !uid) {
        res.status(400).end();
    }

    extractTokenInfoWithoutVerify(req)
        .then(token => queryBindingOrderPayment(token, orderid, uid))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});

/*
router.patch('/:orderid/materials', async (req, res, next) => {
    let orderid = req.params.orderid;
    if (!orderid) {
        res.status(400).end();
    }

    extractTokenInfoWithoutVerify(req)
        .then(token => uploadMaterials(token, orderid, req.body.materials))
        .then(result => res.status(200).jsonp(result))
        .catch(e => {
            handleServiceException(e, res);
        });
});
*/

//======================= Simulate ===========================
//for DEV | UAT only: simulate a Pre-Order
if (global.config.isDev || global.config.isUAT) {

    router.get("/simulate-get-pomsid/:pomsid", async (req, res, next) => {
        let pomsid = req.params.pomsid;
        simulateGetOrderByPomsid(pomsid)
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.post("/:orderid/simulate-payment-record", async (req, res, next) => {
        let orderid = req.params.orderid;
        let amount: number = req.body.amount;
        let type = req.body.type;
        let status = req.body.status;
        simulatePaymentRecord(orderid, amount, type, status)
            .then(result => res.status(200).jsonp({success: true}))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.post('/:orderid/simulate-preorder', async (req, res, next) => {
        let orderid = req.params.orderid;
        let amount: number = req.body.amount;
        simulatePreOrderByOrderId(orderid, amount)
            .then(result => res.status(200).jsonp({success: true}))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.post("/:orderid/simulate-vin", async (req, res, next) => {
        let orderid = req.params.orderid;
        let vin = req.body.vin;
        let engineNo = req.body.engineNo;
        simulateVinNotification(orderid, vin, engineNo)
            .then(result => res.status(200).jsonp({success: true}))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.post('/:configid/simulate-preorder-config', async (req, res, next) => {
        let configid = req.params.configid;
        let amount: number = req.body.amount;
        simulatePreOrderByConfigId(configid, amount)
            .then(result => res.status(200).jsonp({success: true}))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.get('/:orderid/simulate-get-order', async (req, res, next) => {
        let orderid = req.params.orderid;
        simulateGetOrder(orderid)
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.get('/:orderid/simulate-get-payments', async (req, res, next) => {
        let orderid = req.params.orderid;
        simulateGetPayments(orderid)
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.delete('/simulate-delete', async (req, res, next) => {
        let orderid = req.params.orderid;
        simulateGetPayments(orderid)
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    });

    router.post('/:orderid/simulate-poms-sns', async (req, res, next) => {
        simulatePomsSns(req.body)
            .then(result => res.status(200).jsonp(result))
            .catch(e => {
                handleServiceException(e, res);
            });
    });
}


//======================= OneTimeUpdate ===========================
/*
router.post('/one-time/v1.10.0', async (req, res, next) => {
    oneTimeUpdate_ALL_v1_10_0()
    .then(result => res.status(200).jsonp({success: true}))
    .catch(e => {
        handleServiceException(e, res);
    });
});
*/

export {router};

