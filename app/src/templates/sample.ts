import type { HandoverRecord } from 'core';

/** Two 32 by 24 JPEG pictures drawn for this repository: diagonal stripes and a ring with a bar. */
const PHOTO_FRONT = {
  digest: 'b26101609a3af7a3ab570e30aa86370f1d164c83e24af01f1e6c81347394f7d4',
  mime: 'image/jpeg',
  width: 32,
  height: 24,
  dataBase64:
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAYACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0DxF4o1f49X0fhDw7qFxaeBNFhQ6lr+qP808cY/4+LhjtznYWVDgsQXbbj92eIvFGr/Hq+j8IeHdQuLTwJosKHUtf1R/mnjjH/HxcMduc7CyocFiC7bcfu8v/AJKb/wAUH4D/AOJD8OtJ/wBJ1TWbv5ftGOWubhjtznZlIzjO0E7QgER/yU3/AIoPwH/xIfh1pP8ApOqazd/L9oxy1zcMduc7MpGcZ2gnaEAi/O7uW7vf8fJeS6s+1UVHZWt+Hm/N9EaniLxRq/x6vo/CHh3ULi08CaLCh1LX9Uf5p44x/wAfFwx25zsLKhwWILttx+7PEXijV/j1fR+EPDuoXFp4E0WFDqWv6o/zTxxj/j4uGO3OdhZUOCxBdtuP3eX/AMlN/wCKD8B/8SH4daT/AKTqms3fy/aMctc3DHbnOzKRnGdoJ2hAIj/kpv8AxQfgP/iQ/DrSf9J1TWbv5ftGOWubhjtznZlIzjO0E7QgERdy3d7/AI+S8l1YKKjsrW/Dzfm+iD/kpv8AxQfgP/iQ/DrSf9J1TWbv5ftGOWubhjtznZlIzjO0E7QgER/yU3/ig/Af/Eh+HWk/6Tqms3fy/aMctc3DHbnOzKRnGdoJ2hAIiilH3+W/2r/cunoVP3Oe32bW9X1fmH/JTf8Aig/Af/Eh+HWk/wCk6prN38v2jHLXNwx25zsykZxnaCdoQCKW0tJ/i3dQ/Dr4dQyaV4D09xLqGqTKd942f+PifoWLFfki4ztBIUKBEUUQ99xv9q/3Lp6CqP2am19m1vV9X3Z//9k=',
} as const;

const PHOTO_BACK = {
  digest: 'f5162d7131119e0c518e671f147ed80b71f263aefc01cad7e288298738c4efb5',
  mime: 'image/jpeg',
  width: 32,
  height: 24,
  dataBase64:
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAYACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7dvLy306znu7ueO1tYI2llnmcIkaKMszMeAAASSelfOWo/tSeIvHuuPpHwj8HyeIGgkxNqepoyW+P3mOAyBAwQMrSOpPK7M4rX/bXutTt/gq0dgshtZ9St478pFvAgw7DccHYPNWH5uOcDPzYMPiH46+D/g54B0Pwz4HH/CQ65JY2q6RpkMDbpBMu6OacKq/O+Q5QASO0i8KH3D7ChRXIpqPM27JdFbqz56c/eteyRkS/tK+P/hjqEY+KngH7FpdxtEV/onzLGxEnyEmR43clB8vmIyqC2GyK9k+EfxPt/i54TbX7TS73S7U3c1vEt6oBmRGwsiEcEEEA46Orrk7dx8n8G/AHxL8QvE8HjH4v332yaKeWW18KKwktLblQmcOybMICY1zuwhd2JdSfsif6Hq/xR03Svm8H2uuH+yXi/eQNlpFbZNyZP3aW/wDEeCp/iydK0KMqcpQS5o2va9u2goOakk9n957J8UvBz+P/AIea/wCHopI4ri/tHjheZFZFlHzJu3I+BuC5YLuHVSGAI+d/D/wD+JX7PWr3Gq+AG0Xxr9ugW2ni1C2W2nj+YsSu6UYQbVziX5iwyh2BgUVxUsTOlFwVnF7pmsqak79TY1fw58f/AIw6fLouunRfAeiyYhvfsj75buFyN4Gx5T8oU/LvjDBypJBOPdfh/wDD/Rfhl4YttC0K2+z2cPzO7kGWeQgbpZGwNznA56AAAAAAAopVK8qkeRJJdkOMFF33Z//Z',
} as const;

/** A filled rental return with made up names. Copy it before changing it. */
export const sampleRecord: HandoverRecord = {
  format: 1,
  form: { templateId: 'rental-return', title: 'Rental return' },
  sealedAt: null,
  parties: { giver: 'Mara Oduya', receiver: 'Tobin Larch' },
  fields: [
    { id: 'item', label: 'Item', kind: 'text', value: 'Cargo trailer, 2 m' },
    { id: 'condition', label: 'Condition', kind: 'choice', value: 'worn', options: ['good', 'worn', 'damaged'] },
    { id: 'mileage', label: 'Mileage', kind: 'number', value: '312.5', unit: 'km' },
    { id: 'fuel', label: 'Fuel', kind: 'choice', value: null, options: ['full', 'half', 'empty'] },
    { id: 'damage', label: 'Damage notes', kind: 'text', value: 'Scratch on the left panel' },
    { id: 'photo-front', label: 'Photo, front', kind: 'photo', value: null, photoDigest: PHOTO_FRONT.digest },
    { id: 'photo-back', label: 'Photo, back', kind: 'photo', value: null, photoDigest: PHOTO_BACK.digest },
  ],
  photos: [{ ...PHOTO_FRONT }, { ...PHOTO_BACK }],
  signatures: [
    {
      party: 'giver',
      strokes: [
        [100, 600, 180, 300, 260, 650, 340, 280, 420, 620, 500, 350],
        [120, 780, 480, 760],
      ],
    },
    {
      party: 'receiver',
      strokes: [
        [150, 500, 250, 250, 350, 520, 450, 260, 550, 540, 700, 300, 800, 600],
        [200, 800, 760, 820],
      ],
    },
  ],
};