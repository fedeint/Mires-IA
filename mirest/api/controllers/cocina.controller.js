import * as service from "../services/cocina.service.js";

export async function list(_req, res, next) {
  try {
    const data = await service.list();
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = await service.create(req.body || {});
    res.status(201).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}
