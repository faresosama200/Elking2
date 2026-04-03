const prisma = require("../config/prisma");
const { buildPagination } = require("../utils");

function createCrudHandlers(config) {
  const { model, searchFields = [], include } = config;

  return {
    list: async (req, res, next) => {
      try {
        const { q } = req.query;
        const { limit, page, skip } = buildPagination(req.query);

        const where = q
          ? {
              OR: searchFields.map((field) => ({
                [field]: { contains: q }
              }))
            }
          : undefined;

        const [items, total] = await Promise.all([
          prisma[model].findMany({
            where,
            include,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" }
          }),
          prisma[model].count({ where })
        ]);

        return res.json({
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } catch (error) {
        return next(error);
      }
    },

    getOne: async (req, res, next) => {
      try {
        const item = await prisma[model].findUnique({
          where: { id: req.params.id },
          include
        });

        if (!item) {
          return res.status(404).json({ message: "Record not found" });
        }

        return res.json(item);
      } catch (error) {
        return next(error);
      }
    },

    create: async (req, res, next) => {
      try {
        const item = await prisma[model].create({ data: req.body, include });
        return res.status(201).json(item);
      } catch (error) {
        return next(error);
      }
    },

    update: async (req, res, next) => {
      try {
        const item = await prisma[model].update({
          where: { id: req.params.id },
          data: req.body,
          include
        });
        return res.json(item);
      } catch (error) {
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Record not found" });
        }
        return next(error);
      }
    },

    remove: async (req, res, next) => {
      try {
        await prisma[model].delete({ where: { id: req.params.id } });
        return res.json({ message: "Deleted successfully" });
      } catch (error) {
        if (error.code === "P2025") {
          return res.status(404).json({ message: "Record not found" });
        }
        return next(error);
      }
    }
  };
}

module.exports = createCrudHandlers;
