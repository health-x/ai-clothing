
import { GoogleGenAI } from "@google/genai";
import { MODEL_NAME } from '../constants';

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateClothingImage = async (prompt: string): Promise<string> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{ text: `Generate a high-quality, professional studio photo of a single piece of clothing: ${prompt}. Pure white background, high resolution, fashion catalog style. The clothing should be displayed clearly.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error('未能生成图片内容');

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error('AI 返回结果中未包含有效的图片数据');
  } catch (error: any) {
    console.error('生成衣物失败:', error);
    throw new Error(error.message || '生成衣物失败，请检查网络或提示词');
  }
};

export const generateTryOnResult = async (personBase64: string, clothesBase64: string): Promise<string> => {
  const ai = getAIClient();
  
  const personData = personBase64.split(',')[1] || personBase64;
  const clothesData = clothesBase64.split(',')[1] || clothesBase64;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: personData, mimeType: 'image/png' } },
          { inlineData: { data: clothesData, mimeType: 'image/png' } },
          { 
            text: `SYSTEM MISSION: PHOTOREALISTIC IDENTITY-PRESERVED CLOTHING SWAP.
            
            - IMAGE 1 (SOURCE PERSON): This is the ONLY reference for the human. You MUST maintain 100% identical facial features, bone structure, eyes, hair, skin details, and EXACT body physique/proportions. DO NOT alter, beautify, or change the person in any way.
            - IMAGE 2 (TARGET CLOTHING): This is the ONLY reference for the outfit. 
            
            EXECUTION STEPS:
            1. Extract the person from Image 1 exactly as they are.
            2. "Dress" this exact person in the clothing shown in Image 2.
            3. Ensure the clothing fits the person's specific body shape from Image 1 naturally.
            4. Keep the same pose and height as Image 1 if possible.
            
            CRITICAL CONSTRAINT: 
            The output person MUST be the EXACT SAME person as in Image 1. If the face looks even slightly different, the task has failed. High-fidelity identity preservation is the top priority.
            
            ENVIRONMENT: 
            Clean professional studio background, consistent with a high-end fashion shoot.` 
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) throw new Error('生成结果为空');

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error('未能从模型获取到图像');
  } catch (error: any) {
    console.error('换装合成失败:', error);
    throw new Error(error.message || '换装合成失败，请稍后重试');
  }
};

export const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('文件转换 Base64 失败'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('图片下载失败:', e);
    throw new Error('无法加载图片，可能是由于跨域限制。请尝试通过“本地上传”功能上传您的照片。');
  }
};
