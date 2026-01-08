
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service to manage reviews
 */
export const reviewService = {
    /**
     * Get reviews for a restaurant with optional filters
     */
    async getReviews(restaurantId, filter = {}) {
        const where = { restaurantId };
        
        if (filter.status && filter.status !== 'ALL') {
            where.status = filter.status;
        }
        
        if (filter.source && filter.source !== 'ALL') {
            where.source = filter.source;
        }

        return await prisma.review.findMany({
            where,
            orderBy: { postedAt: 'desc' }
        });
    },

    /**
     * Sync reviews (Mock Implementation)
     * Populates database with realistic looking mock data for demo purposes
     */
    async syncReviews(restaurantId) {
        // Check if we already have reviews to avoid duplicates in this simple mock
        const count = await prisma.review.count({ where: { restaurantId } });
        if (count > 0) return { message: "Reviews already synced", count };

        const mockReviews = [
            {
                source: "GOOGLE",
                authorName: "Sarah Jenkins",
                rating: 5,
                content: "Absolutely loved the butter chicken! The naan was fresh and the service was quick. Will definitely come back.",
                postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
                status: "UNANSWERED"
            },
            {
                source: "YELP",
                authorName: "Mike T.",
                rating: 3,
                content: "Food was good but the delivery took over an hour. It was cold by the time it arrived.",
                postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
                status: "UNANSWERED"
            },
            {
                source: "FACEBOOK",
                authorName: "Jessica Lee",
                rating: 5,
                content: "Best Indian food in town! The staff is so friendly.",
                postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
                status: "ANSWERED",
                replyContent: "Thank you so much Jessica! We're thrilled to hear you enjoyed your experience. See you soon!",
                replySentAt: new Date()
            },
            {
                source: "GOOGLE",
                authorName: "David Chen",
                rating: 4,
                content: "Great atmosphere, but a bit pricey for the portion sizes.",
                postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
                status: "UNANSWERED"
            },
            {
                source: "YELP",
                authorName: "Emily R.",
                rating: 1,
                content: "They got my order completely wrong and refused to refund me. Terrible service.",
                postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 0.5), // 12 hours ago
                status: "UNANSWERED"
            }
        ];

        for (const review of mockReviews) {
            await prisma.review.create({
                data: {
                    restaurantId,
                    ...review
                }
            });
        }

        return { message: "Synced 5 mock reviews", count: 5 };
    },

    /**
     * Generate an AI reply based on tone
     */
    async generateReply(reviewId, tone) {
        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review) throw new Error("Review not found");

        // Mock AI generation for now - simply purely deterministic based on tone
        // In a real app, this would call OpenAI/Gemini
        let reply = "";
        
        if (tone === 'Professional') {
            reply = `Dear ${review.authorName}, thank you for your feedback. We appreciate you bringing this to our attention. We strive to provide the best service and will look into this matter immediately.`;
        } else if (tone === 'Grateful') {
            reply = `Hi ${review.authorName}! \n\nThank you so much for the kind words! We're so happy you visited us. We can't wait to serve you again soon!`;
        } else if (tone === 'Apologetic') {
            reply = `Hello ${review.authorName}, we are truly sorry to hear about your experience. This is not the standard we aim for. Please contact us directly so we can make this right.`;
        } else {
             reply = `Thank you for your feedback, ${review.authorName}.`;
        }

        return { reply };
    },

    /**
     * Post a reply to a review
     */
    async postReply(reviewId, content) {
        return await prisma.review.update({
            where: { id: reviewId },
            data: {
                replyContent: content,
                replySentAt: new Date(),
                status: "ANSWERED"
            }
        });
    }
};
