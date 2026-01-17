
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const feedbackService = {
    /**
     * Create new private feedback
     */
    async createFeedback(restaurantId, data) {
        return await prisma.feedback.create({
            data: {
                restaurantId,
                customerName: data.name,
                customerPhone: data.phone,
                email: data.email,
                rating: parseInt(data.rating),
                content: data.content
            }
        });
    },

    /**
     * Get feedback for a restaurant
     */
    async getFeedback(restaurantId) {
        return await prisma.feedback.findMany({
            where: { restaurantId },
            orderBy: { createdAt: 'desc' }
        });
    },

    /**
     * Mark feedback as resolved
     */
    async resolveFeedback(id) {
        return await prisma.feedback.update({
            where: { id },
            data: { isResolved: true }
        });
    }
};
